import { ComboType, type Combo } from '../types';

const COMBO_NAME_MAP: Record<ComboType, string> = {
  [ComboType.PASS]: '过',
  [ComboType.SINGLE]: '单张',
  [ComboType.PAIR]: '对子',
  [ComboType.TRIPLE]: '三条',
  [ComboType.TRIPLE_WITH_TWO]: '三带二',
  [ComboType.STRAIGHT]: '顺子',
  [ComboType.STRAIGHT_PAIR]: '连对',
  [ComboType.PLATE]: '钢板',
  [ComboType.BOMB_4]: '4炸',
  [ComboType.BOMB_5]: '5炸',
  [ComboType.BOMB_6]: '6炸',
  [ComboType.BOMB_7]: '7炸',
  [ComboType.BOMB_8]: '8炸',
  [ComboType.STRAIGHT_FLUSH]: '同花顺',
  [ComboType.ROCKET]: '天王炸',
};

export function getComboDisplayName(combo: Combo | null | undefined): string {
  if (!combo) return '-';
  return COMBO_NAME_MAP[combo.type] || String(combo.type);
}
