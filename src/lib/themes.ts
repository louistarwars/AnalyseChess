export interface BoardTheme {
  id: string;
  name: string;
  light: string;
  dark: string;
  hlLight: string;
  hlDark: string;
}

export const BOARD_THEMES: BoardTheme[] = [
  { id: 'green', name: 'Émeraude', light: '#ebecd0', dark: '#739552', hlLight: '#f5f682', hlDark: '#b9ca43' },
  { id: 'brown', name: 'Bois', light: '#f0d9b5', dark: '#b58863', hlLight: '#f6eb72', hlDark: '#dcc34b' },
  { id: 'blue', name: 'Océan', light: '#dee3e6', dark: '#8ca2ad', hlLight: '#c3d888', hlDark: '#92b166' },
  { id: 'slate', name: 'Ardoise', light: '#e4e7ec', dark: '#6b7a94', hlLight: '#f1e98c', hlDark: '#b4ad5b' },
  { id: 'purple', name: 'Améthyste', light: '#e9e2f6', dark: '#8a74bd', hlLight: '#f3ec8a', hlDark: '#c2b05a' },
  { id: 'coral', name: 'Corail', light: '#f5e7dd', dark: '#d58a6e', hlLight: '#f7ec86', hlDark: '#e0b85a' },
];

export const PIECE_SETS = [
  { id: 'cburnett', name: 'Classique' },
  { id: 'merida', name: 'Merida' },
  { id: 'chessnut', name: 'Moderne' },
];

export function pieceUrl(set: string, color: 'w' | 'b', type: string): string {
  return `pieces/${set}/${color}${type.toUpperCase()}.svg`;
}
