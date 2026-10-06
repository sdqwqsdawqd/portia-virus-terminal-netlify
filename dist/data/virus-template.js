// СКОПИРУЙТЕ ЭТОТ ФАЙЛ в папку data/viruses/ и замените значения.
// Затем импортируйте новую запись в data/viruses.js.

export const newVirus = {
  id: "unique-virus-id",
  code: "VIR-000",
  name: "НАЗВАНИЕ",
  status: "НАБЛЮДЕНИЕ",

  // Только фото ПОСЛЕ заражения. null показывает заглушку.
  infectedImage: "assets/viruses/infected-subject.png",

  external: "Описание внешних характеристик инфицированного.",
  ppu: {
    health: "Описание здоровья.",
    speed: "Описание скорости.",
    abilities: "Описание способностей."
  },
  physiology: "Описание физиологических характеристик.",
  mutations: [
    {
      name: "Название мутации",
      description: "Описание мутации.",
      image: "assets/viruses/mutation-01.png"
    }
  ],
  classification: {
    danger: "Гефест",
    spread: "Номос",
    transmission: "Контактно-бытовой",
    escapeRisk: "Предупреждение",
    mind: "Нигредо",
    appearance: "Нюктея",
    behavior: "Фобус"
  },
  scientistLogs: [
    {
      id: "unique-log-01",
      title: "ЗАПИСЬ 01",
      scientist: "ИМЯ УЧЁНОГО",
      lockedLevel: 3,
      content: ["Здесь будет текст записи учёного."]
    },
    {
      id: "unique-log-02",
      title: "ЗАПИСЬ 02",
      scientist: "ИМЯ УЧЁНОГО",
      lockedLevel: 4,
      content: ["Здесь будет текст записи учёного."]
    }
  ]
};
