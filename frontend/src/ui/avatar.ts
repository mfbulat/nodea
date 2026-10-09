// Цвет аватара по имени — одинаковый у комментариев, исполнителей задач и участников.
const COLORS = ['#ff6b6b', '#ff9f69', '#f5c242', '#5cc98d', '#4fc3e8', '#6f8cf6', '#b07cf0', '#f07cb4']
export const avatarColor = (name: string) => COLORS[[...(name || '?')].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) % COLORS.length]
