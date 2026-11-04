export type Mutation = {
  name: string;
  description: string;
  image: string;
};

export type RichTextStyle = {
  color?: string;
  fontSize?: number;
  fontWeight?: number;
  backgroundColor?: string;
  backgroundOpacity?: number;
};

export type RichTextRun = {
  text: string;
  style?: RichTextStyle;
};

export type RichTextDocument = {
  runs: RichTextRun[];
};

export type ScientistLog = {
  id: string;
  title: string;
  scientist: string;
  lockedLevel: number;
  content: string[];
  richContent?: RichTextDocument;
};

export const classificationOptions = {
  danger: [
    { value: "Гефест", level: 1 },
    { value: "Протей", level: 2 },
    { value: "Апейрон", level: 3 },
  ],
  spread: [
    { value: "Номос", level: 1 },
    { value: "Тезей", level: 2 },
    { value: "Абраксас", level: 3 },
  ],
  transmission: [
    { value: "Воздушно-капельный" },
    { value: "Воздушно-пылевой" },
    { value: "Контактно-бытовой" },
    { value: "Фекально-оральный" },
    { value: "Половой" },
    { value: "Неизвестно" },
  ],
  escapeRisk: [
    { value: "Предупреждение", level: 1 },
    { value: "Риск", level: 2 },
    { value: "Эснов", level: 3 },
  ],
  mind: [
    { value: "Люцидиум", level: 1 },
    { value: "Транзитиум", level: 2 },
    { value: "Обливиум", level: 3 },
  ],
  appearance: [
    { value: "Изоморф", level: 1 },
    { value: "Полиморф", level: 2 },
    { value: "Ксеноморф", level: 3 },
  ],
  behavior: [
    { value: "Стабилар", level: 1 },
    { value: "Импульсар", level: 2 },
    { value: "Инфернар", level: 3 },
  ],
} satisfies Record<keyof Virus["classification"], readonly { value: string; level?: number }[]>;

// D-35 / D-36(а): the old names of the three renamed axes, mapped to the new ones with the same level.
// Saved records may still carry an old name until the SQL rewrite (20-21) runs; reading maps it, saving writes the new name.
export const legacyClassificationNames: Readonly<Record<string, string>> = Object.freeze({
  "Рубедо": "Люцидиум", "Альбедо": "Транзитиум", "Нигредо": "Обливиум",
  "Фобус": "Стабилар", "Ареус": "Импульсар", "Селенус": "Инфернар",
  "Нюктея": "Изоморф", "Морфея": "Полиморф", "Дедалея": "Ксеноморф",
});

// The accent mark U+0301 belongs only to the text of the «Классификация» section (D-37); a class value never keeps it.
// Own keys only (Object.hasOwn), so "__proto__" or "constructor" never resolve to a prototype member; unknown values stay as they are.
export function canonicalClassificationName(value: string): string {
  const plain = value.replace(/́/g, "");
  return Object.hasOwn(legacyClassificationNames, plain) ? legacyClassificationNames[plain] : plain;
}

export function scientistLogPlainText(log: ScientistLog) {
  if (log.richContent?.runs?.length) return log.richContent.runs.map((run) => run.text).join("");
  return log.content.join("\n\n");
}

export type Virus = {
  id: string;
  code: string;
  name: string;
  status: string;
  infectedImage: string;
  external: string;
  ppu: { health: string; speed: string; abilities: string };
  physiology: string;
  mutations: Mutation[];
  classification: {
    danger: string;
    spread: string;
    transmission: string;
    escapeRisk: string;
    mind: string;
    appearance: string;
    behavior: string;
  };
  scientistLogs: ScientistLog[];
};

// Guides (03.3 D-06..D-08): a category holds ordered subcategories, each a list of blocks in any order.
export type InfoBlock =
  | { id: string; type: "text"; text: string }
  | { id: string; type: "table"; rows: { id: string; key: string; value: string }[] }
  | { id: string; type: "photo"; url: string }
  | { id: string; type: "video"; videoId: string };

export type InfoSubsection = {
  id: string;
  title: string;
  blocks: InfoBlock[];
};

export type InfoSection = {
  id: string;
  title: string;
  body: string;
  subsections: InfoSubsection[];
};

// Resolves a section id or a subsection id to the section (and subsection) it names.
export function findInfo(sections: InfoSection[], id: string): { section: InfoSection; subsection: InfoSubsection | null } | null {
  for (const section of sections) {
    if (section.id === id) return { section, subsection: null };
    const subsection = section.subsections.find((item) => item.id === id);
    if (subsection) return { section, subsection };
  }
  return null;
}

// Справочник (Phase 13 D-01..D-06): a section holds cards, a card is one ribbon of blocks; heading text, captions and the callout label are plain strings, text and callout bodies are formatted.
export type GuideBlock =
  | { id: string; type: "heading"; text: string }
  | { id: string; type: "text"; text: string }
  | { id: string; type: "table"; rows: { id: string; key: string; value: string }[] }
  | { id: string; type: "photo"; url: string; caption: string }
  | { id: string; type: "video"; videoId: string }
  | { id: string; type: "callout"; label: string; text: string };

export type GuideCard = {
  id: string;
  title: string;
  cover: string;
  blocks: GuideBlock[];
};

export type GuideSection = {
  id: string;
  title: string;
  photo: string;
  cards: GuideCard[];
};

// Resolves a section id or a card id to the section (and card) it names.
export function findGuide(sections: GuideSection[], id: string): { section: GuideSection; card: GuideCard | null } | null {
  for (const section of sections) {
    if (section.id === id) return { section, card: null };
    const card = section.cards.find((item) => item.id === id);
    if (card) return { section, card };
  }
  return null;
}

export type Broadcast = {
  id: string;
  type: "quest" | "task" | "news";
  title: string;
  body: string;
  published: boolean;
  important: boolean;
  // Quest period, YYYY-MM-DD or empty, and plain-text conditions (03.2 D-03).
  startsAt: string;
  endsAt: string;
  conditions: string;
};

export type RecycleFile = {
  id: string;
  name: string;
  location: string;
  kind: "virus" | "text" | "image";
  content: string;
  image: string;
  virusId: string;
};

export type PortiaContent = {
  viruses: Virus[];
  recycledViruses: Virus[];
  infoSections: InfoSection[];
  guideSections: GuideSection[];
  broadcasts: Broadcast[];
  recycleFiles: RecycleFile[];
  recycleOrder: string[];
  searchRecommendations: string[];
  assistantAdvice: string[];
  assistantOffendedPhrase: string;
  assistantOffendedPhrases: string[];
  assistantPatienceSeconds: number;
  assistantPatienceVariants: number[];
  assistantIdlePhrases: string[];
  assistantActivityPhrases: string[];
  assistantIdleEnabled: boolean;
  assistantActivityEnabled: boolean;
  assistantAutoTimingMode: "fixed" | "random";
  assistantAutoIntervalSeconds: number;
  assistantAutoMinSeconds: number;
  assistantAutoMaxSeconds: number;
  formattedText: Record<string, RichTextDocument>;
};

export const portiaTextKey = {
  virus: (virusId: string, field: "external" | "physiology" | "ppu-health" | "ppu-speed" | "ppu-abilities") => `virus:${virusId}:${field}`,
  mutation: (virusId: string, index: number) => `virus:${virusId}:mutation:${index}:description`,
  info: (sectionId: string) => `info:${sectionId}:body`,
  infoBlock: (blockId: string) => `info-block:${blockId}:text`,
  guideBlock: (blockId: string) => `guide-block:${blockId}:text`,
  broadcast: (broadcastId: string) => `broadcast:${broadcastId}:body`,
  recycle: (fileId: string) => `recycle:${fileId}:content`,
  searchRecommendations: "search:recommendations",
  assistantAdvice: "assistant:advice",
  assistantOffended: "assistant:offended",
  assistantIdle: "assistant:idle",
  assistantActivity: "assistant:activity",
} as const;

export function createVirusRecycleFiles(viruses: Virus[]): RecycleFile[] {
  return viruses.slice(0, 3).map((virus) => ({
    id: `recycle-${virus.id}`,
    name: `${virus.name}_${virus.code}.virus`,
    location: "C:\\PORTIA\\VIRUS_ARCHIVE",
    kind: "virus",
    content: "",
    image: "",
    virusId: virus.id,
  }));
}

const placeholderLogs = (prefix: string): ScientistLog[] => [
  {
    id: `${prefix}-log-01`,
    title: "ЗАПИСЬ 01",
    scientist: "ИМЯ УЧЁНОГО",
    lockedLevel: 3,
    content: ["Здесь будет текст записи учёного."],
  },
  {
    id: `${prefix}-log-02`,
    title: "ЗАПИСЬ 02",
    scientist: "ИМЯ УЧЁНОГО",
    lockedLevel: 4,
    content: ["Здесь будет текст записи учёного."],
  },
  {
    id: `${prefix}-log-03`,
    title: "ЗАПИСЬ 03",
    scientist: "ИМЯ УЧЁНОГО",
    lockedLevel: 3,
    content: ["Здесь будет текст записи учёного."],
  },
];

export const defaultPortiaContent: PortiaContent = {
  viruses: [
    {
      id: "vir-d17",
      code: "VIR-Δ17",
      name: "МОРОК",
      status: "ИЗОЛИРОВАН",
      infectedImage: "",
      external:
        "После распыления эпидермис приобретает графитовый оттенок, радужка становится светочувствительной. На предплечьях проявляются симметричные линии пигментации.",
      ppu: {
        health: "Повышенная устойчивость к травмам; показатель условной целостности — 168%.",
        speed: "Кратковременное ускорение до 42 км/ч, затем выраженное истощение.",
        abilities: "Ориентация в полной темноте, подавление болевой реакции, усиленный слух.",
      },
      physiology:
        "Пульс нестабилен, температура тела понижена. Обнаружено ускоренное восстановление мягких тканей при отсутствии яркого света.",
      mutations: [
        {
          name: "Мутация M-1 / Теневой покров",
          description: "Пигментные клетки перестраиваются и снижают визуальную заметность субъекта в затемнённой среде.",
          image: "",
        },
        {
          name: "Мутация M-2 / Эхо",
          description: "Слуховой аппарат гипертрофируется; субъект начинает ориентироваться по отражённым звукам.",
          image: "",
        },
      ],
      classification: {
        danger: "Протей",
        spread: "Тезей",
        transmission: "Воздушно-пылевой",
        escapeRisk: "Риск",
        mind: "Транзитиум",
        appearance: "Полиморф",
        behavior: "Стабилар",
      },
      scientistLogs: placeholderLogs("morok"),
    },
    {
      id: "vir-t04",
      code: "VIR-Θ04",
      name: "АРАХНА",
      status: "НАБЛЮДЕНИЕ",
      infectedImage: "",
      external:
        "Конечности удлиняются, суставы сохраняют подвижность под неестественными углами. На коже появляются бирюзовые сосудистые узоры.",
      ppu: {
        health: "Условная целостность — 134%; высокая сопротивляемость токсинам.",
        speed: "Высокая скорость на вертикальных поверхностях, средняя — на открытой местности.",
        abilities: "Сцепление с гладкими поверхностями, создание прочных белковых нитей.",
      },
      physiology:
        "Формируются дополнительные сухожильные соединения. Дыхательная система адаптируется к среде с низким содержанием кислорода.",
      mutations: [
        {
          name: "Мутация A-1 / Нить",
          description: "Железы на ладонях производят быстро затвердевающий белковый состав.",
          image: "",
        },
      ],
      classification: {
        danger: "Гефест",
        spread: "Номос",
        transmission: "Контактно-бытовой",
        escapeRisk: "Предупреждение",
        mind: "Обливиум",
        appearance: "Ксеноморф",
        behavior: "Инфернар",
      },
      scientistLogs: placeholderLogs("arahna"),
    },
    {
      id: "vir-s12",
      code: "VIR-Σ12",
      name: "КАЛЛИСТО",
      status: "КАРАНТИН",
      infectedImage: "",
      external:
        "Рост субъекта увеличивается, костная структура уплотняется. На шее и груди формируются светлые пластины неизвестного состава.",
      ppu: {
        health: "Условная целостность — 219%; критически высокая регенерация костной ткани.",
        speed: "Ниже нормы; движения медленные, но сохраняют большую импульсную силу.",
        abilities: "Высокая физическая сила, устойчивость к холоду, кратковременная минерализация кожи.",
      },
      physiology:
        "Обмен веществ замедлен. Костный мозг производит клетки неизвестного типа, образующие внешний защитный слой.",
      mutations: [
        {
          name: "Мутация K-1 / Панцирь",
          description: "Минеральные пластины покрывают торс и защищают жизненно важные органы.",
          image: "",
        },
        {
          name: "Мутация K-2 / Корона",
          description: "Костные наросты формируют сенсорную структуру, реагирующую на движение воздуха.",
          image: "",
        },
      ],
      classification: {
        danger: "Апейрон",
        spread: "Абраксас",
        transmission: "Воздушно-капельный",
        escapeRisk: "Эснов",
        mind: "Люцидиум",
        appearance: "Изоморф",
        behavior: "Импульсар",
      },
      scientistLogs: placeholderLogs("kallisto"),
    },
  ],
  recycledViruses: [],
  recycleFiles: [
    {
      id: "recycle-vir-d17",
      name: "МОРОК_VIR-Δ17.virus",
      location: "C:\\PORTIA\\VIRUS_ARCHIVE",
      kind: "virus",
      content: "",
      image: "",
      virusId: "vir-d17",
    },
    {
      id: "recycle-vir-t04",
      name: "АРАХНА_VIR-Θ04.virus",
      location: "C:\\PORTIA\\VIRUS_ARCHIVE",
      kind: "virus",
      content: "",
      image: "",
      virusId: "vir-t04",
    },
    {
      id: "recycle-vir-s12",
      name: "КАЛЛИСТО_VIR-Σ12.virus",
      location: "C:\\PORTIA\\VIRUS_ARCHIVE",
      kind: "virus",
      content: "",
      image: "",
      virusId: "vir-s12",
    },
  ],
  recycleOrder: ["file:recycle-vir-d17", "file:recycle-vir-t04", "file:recycle-vir-s12"],
  infoSections: [
    {
      id: "what-is-virus",
      title: "Что такое вирусы?",
      body:
        "Вирус — это биологический агент, который может воспроизводиться только внутри живой клетки. Вирусы могут заражать все типы организмов, от животных и растений до микроорганизмов, включая бактерии и археи. Вирусы обладают разнообразными формами и размерами, и они играют важную роль в экологии и эволюции. Вирусы могут вызывать различные заболевания у людей, животных и растений, а также использоваться в биотехнологии и медицине для разработки вакцин и генной терапии.",
      subsections: [],
    },
    {
      id: "spread-methods",
      title: "Способы распространения вирусов",
      body:
        "Воздушно-капельный — Через микрокапли слюны и слизи при кашле, чихании или разговоре.\n\nВоздушно-пылевой — Через вдыхание частиц пыли, содержащих высохшие вирусы.\n\nКонтактно-бытовой — Через прямое прикосновение к больному или заражённым предметам и поверхностям.\n\nФекально-оральный — Через заглатывание зараженной пищи или воды.\n\nПоловой — Через контакт со слизистыми оболочками и биологическими жидкостями при интимной близости.",
      subsections: [],
    },
    {
      id: "classification",
      title: "Классификация",
      body:
        "Всем вирусам присваивается по три класса. Эти классы отвечают за главные параметры: общие свойства, непредсказуемость и тяжесть содержания; степень распространения и риски заражения; общую угрозу и степень агрессии.\n\nОСНОВНАЯ ЛИНЕЙКА\n\nГефест — субъекты не нуждаются в особых мерах для содержания и устранения. Чаще всего не представляют угрозы заражения или побега и остаются предсказуемыми.\n\nПротей — субъекты непредсказуемы, но не несут особой опасности при использовании соответствующих мер защиты. Требуют усилий для содержания и ликвидации.\n\nАпейрон — наиболее тяжёлые для сдерживания и устранения субъекты. Они полностью непредсказуемы и имеют высокий риск создания чрезвычайной ситуации.\n\nРИСК РАСПРОСТРАНЕНИЯ\n\nНомос — минимальная способность к распространению либо её отсутствие.\n\nТезей — активное распространение, чаще всего воздушно-капельным путём либо через биологические жидкости, но без высокой скорости.\n\nАбраксас — вирус обладает всеми необходимыми свойствами для быстрого распространения.\n\nУГРОЗА И РИСК ПОБЕГА\n\nПредупреждение — свойства для побега отсутствуют либо минимальны.\n\nРиск — субъект может иметь свойства для побега, но напрямую без посторонней помощи не сбежит.\n\nЭснов — крайне сильные и деструктивные свойства; серьёзная угроза и возможность самостоятельно нарушить меры содержания.\n\nДОПОЛНИТЕЛЬНАЯ ЛИНЕЙКА\n\nРАЗУМ\n\nЛюци́диум — Вирусы класса Люци́диум практически не повреждают высшие мыслительные центры испытуемого, в связи с чем его разум сохраняется на среднем/либо высоком уровне, позволяя осознавать происходящее вокруг него и выполнять осознанные действия.\n\nТранзи́тиум — Вирусы класса Транзи́тиум выборочно поражают отдельные структуры головного мозга испытуемого, в связи с чем его разум сохраняется на неполном/либо полном среднем уровне, частично позволяя выполнять осознанные действия и применять базовые бытовые навыки.\n\nОбли́виум — Вирусы класса Обли́виум поражают практически все клетки головного мозга испытуемого, в связи с чем его разум становится либо \"нулевым\", либо на уровне младенца.\n\nПОВЕДЕНИЯ И АГРЕССИЯ\n\nСтабила́р — Вирусы класса Стабила́р при распылении на человека не вызывают вовсе/либо вызывают незначительные побочные эффекты в поведении.\n\nИмпульса́р — Вирусы класса Импульса́р при распылении на человека вызывают умеренные изменения в поведении, выражающиеся в заметной эмоциональной нестабильности, нетипичных поступках и периодических вспышках раздражительности.\nили утрата эмпатии, радости или какой-либо конкретной эмоции.\n\nИнферна́р — Вирусы класса Инферна́р при распылении на человека вызывают критические нарушения поведения, проявляющиеся в экстремальной агрессивности, неконтролируемой ярости и полной потере осознанного самоконтроля.\n\nВНЕШНИЙ ВИД И ФИЗИЧЕСКИЕ ИЗМЕНЕНИЯ\n\nИзомо́рф — Субъекты, инфицированные вирусом класса Изомо́рф подвергаются мутациями, не сильно воздействующим на их внешний вид, облик.\n\nПолимо́рф — Субъекты, инфицированные вирусом класса Полимо́рф, подвергаются умеренным мутациям, заметно изменяющим их внешний вид и пропорции тела, но всё ещё сохраняющим базовые человеческие черты.\n\nКсеномо́рф — Субъекты, инфицированные вирусом класса Ксеномо́рф, подвергаются критическим мутациям, радикально преобразующим их внешний вид и полностью искажающим анатомию тела до неузнаваемости.",
      subsections: [],
    },
    {
      id: "documentation",
      title: "Документация и утверждение",
      body:
        "Создатель первого устава: maryerrar\n\nСоздатель нынешнего устава: anuargovni1\n\nРедакторы: wewewewestrelok, anuargovni1\n\nУтверждено: wewewewestrelok",
      subsections: [],
    },
  ],
  guideSections: [],
  broadcasts: [],
  searchRecommendations: ["МОРОК", "АРАХНА", "КАЛЛИСТО", "Протей", "Воздушно-пылевой"],
  assistantAdvice: [
    "Глобальный поиск видит названия, коды, классификации и сообщения станции.",
    "В каждой карточке только одна запись учёного доступна с уровнем II.",
    "После сохранения изменения автоматически появляются у посетителей.",
    "Файлы в Корзине доступны только для чтения. Управление ими находится в редакторе владельца.",
  ],
  assistantOffendedPhrase: "Я обиделась. Дайте мне немного времени.",
  assistantOffendedPhrases: [
    "Я обиделась. Дайте мне немного времени.",
    "Слишком много нажатий. Я беру короткую паузу.",
    "Мои лапки устали. Вернусь через десять секунд.",
  ],
  assistantPatienceSeconds: 3,
  assistantPatienceVariants: [3],
  assistantIdlePhrases: [
    "Вы давно ничего не делали. Я всё ещё здесь.",
    "Станция притихла. Может, пора продолжить работу?",
    "Тишина затянулась. Позвать вас ещё раз?",
  ],
  assistantActivityPhrases: [
    "Вижу, работа идёт. Не отвлекаю — просто наблюдаю.",
    "Хороший темп. Продолжайте в том же духе.",
    "Вы заняты, а значит станция не простаивает.",
  ],
  assistantIdleEnabled: true,
  assistantActivityEnabled: true,
  assistantAutoTimingMode: "random",
  assistantAutoIntervalSeconds: 60,
  assistantAutoMinSeconds: 45,
  assistantAutoMaxSeconds: 120,
  formattedText: {},
};

export function cloneDefaultContent(): PortiaContent {
  return JSON.parse(JSON.stringify(defaultPortiaContent)) as PortiaContent;
}
