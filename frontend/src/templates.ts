// Встроенные шаблоны карт (собственные, нейтральные).
import type { MapDocument, StructureId, Topic } from './editor/model'
import { uid } from './editor/model'

type Node = string | [string, Node[]] | [string, Node[], Partial<Topic>]

function build(n: Node): Topic {
  if (typeof n === 'string') return { id: uid(), title: n, children: [] }
  const [title, kids, extra] = n
  return { id: uid(), title, children: kids.map(build), ...(extra ?? {}) }
}

function doc(root: Node, structure: StructureId = 'mindmap', theme = 'classic', rainbow = false): MapDocument {
  return { version: 1, sheets: [{ id: uid(), title: 'Лист 1', rootTopic: build(root), structure, theme, rainbow }] }
}

export interface TemplateDef { id: string; title: string; description: string; make: () => MapDocument }

export const TEMPLATES: TemplateDef[] = [
  { id: 'blank', title: 'Пустая карта', description: 'Центральная тема', make: () => doc('Центральная тема') },
  { id: 'blank-logic', title: 'Пустая логическая схема', description: 'Logic Chart вправо', make: () => doc('Центральная тема', 'logic-right') },
  { id: 'brainstorm', title: 'Мозговой штурм', description: 'Идеи по направлениям', make: () => doc(['Тема штурма', [
    ['Идеи', ['Идея 1', 'Идея 2', 'Идея 3']], ['Вопросы', ['Что мешает?', 'Что поможет?']],
    ['Ресурсы', ['Люди', 'Время', 'Бюджет']], ['Следующие шаги', ['Шаг 1', 'Шаг 2']]]], 'mindmap', 'fresh', true) },
  { id: 'swot', title: 'SWOT-анализ', description: 'Сильные и слабые стороны, возможности, угрозы', make: () => doc(['SWOT-анализ', [
    ['Сильные стороны', ['…']], ['Слабые стороны', ['…']], ['Возможности', ['…']], ['Угрозы', ['…']]]], 'mindmap-cw', 'classic', true) },
  { id: 'project', title: 'План проекта', description: 'Этапы, задачи, сроки', make: () => doc(['Проект', [
    ['Инициация', [['Цели', [], { task: { done: false } }], ['Заинтересованные лица', [], { task: { done: false } }]]],
    ['Планирование', [['Объём работ', [], { task: { done: false } }], ['Бюджет', [], { task: { done: false } }], ['Сроки', [], { task: { done: false } }]]],
    ['Исполнение', [['Задача 1', [], { task: { done: false } }], ['Задача 2', [], { task: { done: false } }]]],
    ['Контроль', ['Метрики', 'Риски']], ['Завершение', ['Итоги', 'Уроки']]]], 'logic-right') },
  { id: 'meeting', title: 'Протокол встречи', description: 'Повестка, решения, поручения', make: () => doc(['Встреча', [
    ['Участники', ['…']], ['Повестка', ['Вопрос 1', 'Вопрос 2']], ['Решения', ['…']],
    ['Поручения', [['Кто — что — когда', [], { task: { done: false } }]]], ['Следующая встреча', ['Дата']]]], 'logic-right', 'minimal') },
  { id: 'fishbone', title: 'Анализ причин', description: 'Диаграмма «рыбья кость»', make: () => doc(['Проблема', [
    ['Люди', ['…']], ['Процессы', ['…']], ['Оборудование', ['…']], ['Материалы', ['…']], ['Среда', ['…']], ['Измерения', ['…']]]], 'fishbone-right') },
  { id: 'org', title: 'Оргструктура', description: 'Org Chart', make: () => doc(['Руководитель', [
    ['Отдел 1', ['Сотрудник', 'Сотрудник']], ['Отдел 2', ['Сотрудник']], ['Отдел 3', ['Сотрудник', 'Сотрудник']]]], 'org-down') },
  { id: 'roadmap', title: 'Дорожная карта', description: 'Горизонтальная временная шкала', make: () => doc(['Дорожная карта', [
    ['Квартал 1', ['Цель']], ['Квартал 2', ['Цель']], ['Квартал 3', ['Цель']], ['Квартал 4', ['Цель']]]], 'timeline-h') },
  { id: 'decision', title: 'Принятие решения', description: 'Варианты, за и против', make: () => doc(['Решение', [
    ['Вариант А', [['За', ['…']], ['Против', ['…']]]], ['Вариант Б', [['За', ['…']], ['Против', ['…']]]], ['Критерии', ['Стоимость', 'Сроки', 'Риски']]]], 'mindmap', 'pastel') },
  { id: 'week', title: 'План недели', description: 'Tree Table по дням', make: () => doc(['Неделя', [
    ['Понедельник', ['…']], ['Вторник', ['…']], ['Среда', ['…']], ['Четверг', ['…']], ['Пятница', ['…']]]], 'tree-table') },
  { id: 'book', title: 'Конспект книги', description: 'Главы, идеи, цитаты', make: () => doc(['Название книги', [
    ['Автор и контекст', ['…']], ['Главные идеи', ['Идея 1', 'Идея 2']], ['Цитаты', ['…']], ['Что применить', ['…']]]], 'mindmap-acw', 'fresh') },
]
