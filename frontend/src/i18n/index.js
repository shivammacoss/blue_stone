// src/i18n/index.js
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import en from './locales/en.json'
import ar from './locales/ar.json'
import hi from './locales/hi.json'
import es from './locales/es.json'
import fr from './locales/fr.json'
import zh from './locales/zh.json'
import ja from './locales/ja.json'
import ko from './locales/ko.json'
import pt from './locales/pt.json'
import id from './locales/id.json'
import th from './locales/th.json'
import vi from './locales/vi.json'
import bn from './locales/bn.json'
import uz from './locales/uz.json'

const resources = {
  en: { translation: en },
  ar: { translation: ar },
  hi: { translation: hi },
  es: { translation: es },
  fr: { translation: fr },
  zh: { translation: zh },
  ja: { translation: ja },
  ko: { translation: ko },
  pt: { translation: pt },
  id: { translation: id },
  th: { translation: th },
  vi: { translation: vi },
  bn: { translation: bn },
  uz: { translation: uz }
}

const savedLanguage = localStorage.getItem('language') || 'en'

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: savedLanguage,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    }
  })

export default i18n
