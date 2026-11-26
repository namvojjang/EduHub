// 분류 목록 API가 생기기 전까지 쓰는 임시 고정 목록.
export const CATEGORIES = ['개발', '데이터', '리더십', '직무공통'] as const;

// 분류별 배지·강조 색 (설계명세 6.2). 목록에 없는 분류는 gray.
export const CATEGORY_COLOR: Record<string, string> = {
  개발: 'indigo',
  데이터: 'cyan',
  리더십: 'grape',
  직무공통: 'orange',
};

export function categoryColor(category?: string | null): string {
  return (category && CATEGORY_COLOR[category]) || 'gray';
}
