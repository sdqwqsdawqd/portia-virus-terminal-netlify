// Every Russian text of the tab with seven or more words lives here. Later Phase 22 plans extend this object.
export const usersCopy = {
  tabPendingSuffix: (count: number) => `, ожидают: ${count}`,
  pendingTitle: "ЗАЯВКИ",
  peopleTitle: "ЛЮДИ",
  closedTitle: "Отклонённые и отозванные",
  pendingPlaque: "ОЖИДАЕТ",
  searchLabel: "ПОИСК ПО НИКУ",
  searchPlaceholder: "Начните вводить ник",
  moscowNote: "Время указано по Москве (МСК).",
  truncated: "Показаны первые 50. Уточните поиск.",
  unknownActor: "неизвестно",
  profileLink: "Профиль Roblox ↗",
  profileAria: (nickname: string) => `Профиль Roblox: ${nickname} (откроется в новой вкладке)`,
  closeWindow: "ЗАКРЫТЬ ОКНО",
  typeLabel: "ТИП",
  tableLabel: "В ТАБЛИЦЕ",
  profileLabel: "ПРОФИЛЬ",
  pendingEmpty: {
    heading: "Новых заявок нет",
    body: "Когда посетитель подаст заявку по нику, она появится здесь.",
  },
  peopleEmpty: {
    heading: "Одобренных людей пока нет",
    body: "Одобрите заявку, и человек появится в этом списке.",
  },
  closedEmpty: "Отклонённых и отозванных нет.",
  searchEmpty: {
    heading: "Ничего не найдено",
    body: "Проверьте ник. Поиск идёт по части ника, регистр не важен.",
  },
} as const;
