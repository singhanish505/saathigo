# SaathiGo - AWS ap-south-1 (Mumbai) primary infrastructure.
# This is a skeleton; in real production we'd split into modules (vpc, eks, rds, ...) and use a remote backend.

terraform {
  required_version = ">= 1.6"
  required_providers {
    aws  = { source = "hashicorp/aws",  version = "~> 5.50" }
    helm = { source = "hashicorp/helm", version = "~> 2.13" }
  }
  backend "s3" {
    bucket         = "saathigo-terraform-state"
    key            = "primary/ap-south-1.tfstate"
    region         = "ap-south-1"
    dynamodb_table = "saathigo-terraform-lock"
    encrypt        = true
  }
}

provider "aws" {
  region = var.region
  default_tags {
    tags = {
      project   = "saathigo"
      env       = var.env
      managedBy = "terraform"
    }
  }
}

# ---------- VPC ----------
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.8"
  name    = "saathigo-${var.env}"
  cidr    = "10.40.0.0/16"
  azs     = ["${var.region}a", "${var.region}b", "${var.region}c"]

  private_subnets = ["10.40.0.0/19", "10.40.32.0/19", "10.40.64.0/19"]
  public_subnets  = ["10.40.96.0/20", "10.40.112.0/20", "10.40.128.0/20"]

  enable_nat_gateway = true
  single_nat_gateway = false
  enable_dns_hostnames = true
  enable_flow_log = true
}

# ---------- EKS ----------
module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 20.20"

  cluster_name    = "saathigo-${var.env}"
  cluster_version = "1.30"

  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets

  cluster_endpoint_public_access = true
  enable_irsa = true

  cluster_addons = {
    coredns               = {}
    kube-proxy            = {}
    vpc-cni               = {}
    aws-ebs-csi-driver    = {}
  }

  eks_managed_node_groups = {
    api = {
      desired_size = 6
      min_size     = 4
      max_size     = 200
      instance_types = ["m6g.xlarge"]   # ARM Graviton - 30% cheaper
      capacity_type  = "ON_DEMAND"
      labels = { workload = "api" }
      taints = []
    }
    realtime = {
      desired_size = 4
      min_size     = 2
      max_size     = 80
      instance_types = ["c6g.2xlarge"]  # WebSocket-heavy, network-bound
      capacity_type  = "ON_DEMAND"
      labels = { workload = "realtime" }
    }
    spot = {
      desired_size = 2
      min_size     = 0
      max_size     = 50
      instance_types = ["m6g.xlarge", "m6g.large", "m5.xlarge"]
      capacity_type  = "SPOT"
      labels = { workload = "batch" }
    }
  }
}

# ---------- ElastiCache Redis Cluster (Geo + cache) ----------
resource "aws_elasticache_replication_group" "main" {
  replication_group_id        = "saathigo-${var.env}"
  description                 = "SaathiGo Redis - geo + cache"
  engine                      = "redis"
  engine_version              = "7.1"
  node_type                   = "cache.r6g.xlarge"
  num_node_groups             = 3            # 3 shards (per-city groupings)
  replicas_per_node_group     = 1
  automatic_failover_enabled  = true
  multi_az_enabled            = true
  subnet_group_name           = aws_elasticache_subnet_group.main.name
  security_group_ids          = [aws_security_group.redis.id]
  at_rest_encryption_enabled  = true
  transit_encryption_enabled  = true
  parameter_group_name        = "default.redis7.cluster.on"
  apply_immediately           = true
}

resource "aws_elasticache_subnet_group" "main" {
  name       = "saathigo-${var.env}-redis"
  subnet_ids = module.vpc.private_subnets
}

resource "aws_security_group" "redis" {
  name        = "saathigo-${var.env}-redis"
  description = "Redis access from EKS"
  vpc_id      = module.vpc.vpc_id
  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [module.eks.node_security_group_id]
  }
}

# ---------- RDS Aurora Postgres ----------
resource "aws_rds_cluster" "main" {
  cluster_identifier        = "saathigo-${var.env}"
  engine                    = "aurora-postgresql"
  engine_version            = "16.2"
  database_name             = "saathigo"
  master_username           = "saathigo"
  manage_master_user_password = true
  serverlessv2_scaling_configuration {
    min_capacity = 2
    max_capacity = 64
  }
  db_subnet_group_name      = aws_db_subnet_group.main.name
  vpc_security_group_ids    = [aws_security_group.rds.id]
  backup_retention_period   = 14
  storage_encrypted         = true
  deletion_protection       = true
  skip_final_snapshot       = false
  final_snapshot_identifier = "saathigo-${var.env}-final"
}

resource "aws_rds_cluster_instance" "main" {
  count                = 3
  identifier           = "saathigo-${var.env}-${count.index}"
  cluster_identifier   = aws_rds_cluster.main.id
  instance_class       = "db.serverless"
  engine               = aws_rds_cluster.main.engine
  engine_version       = aws_rds_cluster.main.engine_version
}

resource "aws_db_subnet_group" "main" {
  name       = "saathigo-${var.env}-rds"
  subnet_ids = module.vpc.private_subnets
}

resource "aws_security_group" "rds" {
  name   = "saathigo-${var.env}-rds"
  vpc_id = module.vpc.vpc_id
  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [module.eks.node_security_group_id]
  }
}

# ---------- MSK (Kafka for location pipeline) ----------
resource "aws_msk_cluster" "main" {
  cluster_name           = "saathigo-${var.env}"
  kafka_version          = "3.7.x"
  number_of_broker_nodes = 6  # 2 per AZ
  broker_node_group_info {
    instance_type   = "kafka.m5.large"
    client_subnets  = module.vpc.private_subnets
    security_groups = [aws_security_group.msk.id]
    storage_info {
      ebs_storage_info { volume_size = 200 }
    }
  }
  encryption_info {
    encryption_in_transit { client_broker = "TLS" in_cluster = true }
  }
  enhanced_monitoring = "PER_TOPIC_PER_BROKER"
}

resource "aws_security_group" "msk" {
  name   = "saathigo-${var.env}-msk"
  vpc_id = module.vpc.vpc_id
  ingress {
    from_port       = 9092
    to_port         = 9098
    protocol        = "tcp"
    security_groups = [module.eks.node_security_group_id]
  }
}

# ---------- Outputs ----------
output "cluster_name"     { value = module.eks.cluster_name }
output "redis_endpoint"   { value = aws_elasticache_replication_group.main.primary_endpoint_address }
output "rds_endpoint"     { value = aws_rds_cluster.main.endpoint }
output "kafka_bootstrap"  { value = aws_msk_cluster.main.bootstrap_brokers_tls }
