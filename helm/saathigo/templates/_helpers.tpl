{{/* Common labels and helper templates */}}
{{- define "saathigo.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "saathigo.fullname" -}}
{{- printf "%s-%s" (include "saathigo.name" .) .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "saathigo.api.fullname" -}}
{{- printf "%s-api" (include "saathigo.fullname" .) -}}
{{- end -}}

{{- define "saathigo.labels" -}}
app.kubernetes.io/name: {{ include "saathigo.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version | replace "+" "_" }}
{{- end -}}

{{- define "saathigo.api.selectorLabels" -}}
app.kubernetes.io/name: {{ include "saathigo.name" . }}-api
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}
