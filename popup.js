document.addEventListener('DOMContentLoaded', () => {
  const languageSelect = document.getElementById('language');
  const splitPercentInput = document.getElementById('split-percent');
  const saveButton = document.getElementById('save');
  
  const translations = {
    ru: {
      title: "Настройки Arizona RP Forum Media Extension",
      language: "Язык:",
      splitPercent: "Процент разделения экрана:",
      save: "Сохранить",
      saved: "Настройки сохранены!"
    },
    en: {
      title: "Arizona RP Forum Media Extension Settings",
      language: "Language:",
      splitPercent: "Split Percentage:",
      save: "Save",
      saved: "Settings saved!"
    }
  };
  
  function updateUI(lang) {
    document.getElementById('popup-title').textContent = translations[lang].title;
    document.getElementById('language-label').textContent = translations[lang].language;
    document.getElementById('split-percent-label').textContent = translations[lang].splitPercent;
    saveButton.textContent = translations[lang].save;
  }
  
  chrome.storage.sync.get(['language', 'splitPercent'], (data) => {
    const lang = data.language || 'ru';
    languageSelect.value = lang;
    splitPercentInput.value = data.splitPercent || 50;
    updateUI(lang);
  });
  
  saveButton.addEventListener('click', () => {
    const lang = languageSelect.value;
    chrome.storage.sync.set({
      language: lang,
      splitPercent: parseInt(splitPercentInput.value)
    }, () => {
      chrome.runtime.sendMessage({
        type: "LANGUAGE_CHANGED",
        language: lang
      });
      
      alert(translations[lang].saved);
      window.close();
    });
  });
  
  languageSelect.addEventListener('change', () => {
    updateUI(languageSelect.value);
  });
});