export const LOCAL_LIST_PAGE_SIZE = 20;

export function paginateFilteredList<T>(
  filteredItems: T[],
  currentPage: number,
  pageSize: number = LOCAL_LIST_PAGE_SIZE
): { items: T[]; scrollDisable: boolean } {
  const end = (currentPage + 1) * pageSize;
  const items = filteredItems.slice(0, end);
  return {
    items,
    scrollDisable: items.length >= filteredItems.length,
  };
}
