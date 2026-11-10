// Every Russian text of the tab with seven or more words lives here. Later Phase 22 plans extend this object.
export const usersCopy = {
  tabPendingSuffix: (count: number) => `, ожидают: ${count}`,
  pendingTitle: "ЗАЯВКИ",
  pendingPlaque: "ОЖИДАЕТ",
  pendingEmpty: {
    heading: "Новых заявок нет",
    body: "Когда посетитель подаст заявку по нику, она появится здесь.",
  },
} as const;
