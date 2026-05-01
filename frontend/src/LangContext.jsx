import React, { createContext, useContext, useState } from 'react';
import { translations } from './i18n.js';

const LangContext = createContext(null);

export function LangProvider({ children }) {
  const [lang, setLangState] = useState(
    () => localStorage.getItem('saathigo_lang') || 'en'
  );

  const setLang = (code) => {
    setLangState(code);
    localStorage.setItem('saathigo_lang', code);
  };

  const t = (key, vars = {}) => {
    const str = translations[lang]?.[key] ?? translations.en[key] ?? key;
    return Object.entries(vars).reduce((s, [k, v]) => s.replace(`{${k}}`, v), str);
  };

  return (
    <LangContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}
