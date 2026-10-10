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
  return { version: 1, sheets: [{ id: uid(), title: 'Map 1', rootTopic: build(root), structure, theme, ...(rainbow ? { rainbow } : {}) }] }
}

export interface TemplateDef { id: string; title: string; description: string; category: string; make: () => MapDocument }

const MAIN4: Node = ['Central Topic', ['Main Topic 1', 'Main Topic 2', 'Main Topic 3', 'Main Topic 4']]
const basic = (id: string, title: string, structure: StructureId): TemplateDef =>
  ({ id, title, description: title, category: 'Basic', make: () => doc(MAIN4, structure) })

export const CATEGORIES = ['Basic', 'Knowledge Management', 'Meetings & Planning', 'Education', 'Project Management', 'Life', 'Analysis & Decisions']

export const TEMPLATES: TemplateDef[] = [
  basic('blank', 'Mind Map', 'mindmap-cw'), basic('logic', 'Logic Chart', 'logic-right'), basic('brace', 'Brace Map', 'brace-right'),
  basic('org', 'Org Chart', 'org-down'), basic('tree', 'Tree Chart', 'tree-right'), basic('timeline', 'Timeline', 'timeline-h'),
  basic('fishbone', 'Fishbone', 'fishbone-right'), basic('table', 'Tree Table', 'tree-table'),

  { id: 'problem', title: 'Problem Solving Steps', description: '', category: 'Knowledge Management', make: () => doc(['Problem Solving', [
    ['Define the Problem', ['Symptoms', 'Scope']], ['Gather Facts', ['Data', 'Interviews']], ['Find Root Causes', ['5 Whys']],
    ['Possible Solutions', ['Option A', 'Option B']], ['Choose & Implement', ['Plan', 'Owners']], ['Check Results', ['Metrics']]]], 'mindmap-cw') },
  { id: 'book', title: 'Book Notes', description: '', category: 'Knowledge Management', make: () => doc(['Book Title', [
    ['Author & Context', ['…']], ['Key Ideas', ['Idea 1', 'Idea 2']], ['Quotes', ['…']], ['Takeaways', ['…']]]], 'mindmap-acw') },
  { id: 'concept', title: 'Concept Map', description: '', category: 'Knowledge Management', make: () => doc(['Concept', [
    ['Definition', ['…']], ['Characteristics', ['…', '…']], ['Examples', ['…']], ['Related Concepts', ['…']]]], 'mindmap') },

  { id: 'meeting', title: 'Meeting Minutes', description: '', category: 'Meetings & Planning', make: () => doc(['Meeting', [
    ['Attendees', ['…']], ['Agenda', ['Item 1', 'Item 2']], ['Decisions', ['…']],
    ['Action Items', [['Who — What — When', [], { task: { done: false } }]]], ['Next Meeting', ['Date']]]], 'logic-right') },
  { id: 'bplan', title: 'Business Plan', description: '', category: 'Meetings & Planning', make: () => doc(['Business Plan', [
    ['Resume', ['…']], ['Market', ['Customers', 'Competitors']], ['Product', ['…']], ['Marketing', ['Channels']], ['Finance', ['Revenue', 'Expenses']], ['Team', ['…']]]], 'mindmap-cw') },
  { id: 'event', title: 'Event Planning', description: '', category: 'Meetings & Planning', make: () => doc(['Event', [
    ['Venue', ['…']], ['Date & Time', ['…']], ['Guests', ['List', 'Invitations']], ['Program', ['…']], ['Budget', ['…']]]], 'mindmap-cw') },
  { id: 'week', title: 'Weekly Plan', description: '', category: 'Meetings & Planning', make: () => doc(['Week', [
    ['Monday', ['…']], ['Tuesday', ['…']], ['Wednesday', ['…']], ['Thursday', ['…']], ['Friday', ['…']]]], 'tree-table') },

  { id: 'timetable', title: 'Class Schedule', description: '', category: 'Education', make: () => doc(['Schedule', [
    ['Monday', ['Math', 'Literature']], ['Tuesday', ['Physics', 'History']], ['Wednesday', ['Chemistry', 'English']], ['Thursday', ['Biology']], ['Friday', ['Computer Science']]]], 'tree-table') },
  { id: 'notes', title: 'Lecture Notes', description: '', category: 'Education', make: () => doc(['Lecture Topic', [
    ['Key Concepts', ['…']], ['Examples', ['…']], ['Questions', ['…']], ['Homework', [['…', [], { task: { done: false } }]]]]], 'logic-right') },
  { id: 'learn', title: 'Learning Plan', description: '', category: 'Education', make: () => doc(['Skill', [
    ['Basics', ['Course', 'Book']], ['Practice', ['Project 1', 'Project 2']], ['Community', ['…']], ['Assessment', ['…']]]], 'timeline-h') },
  { id: 'resume', title: 'Resume', description: '', category: 'Education', make: () => doc(['Full Name', [
    ['Contacts', ['…']], ['Experience', ['Company 1', 'Company 2']], ['Education', ['…']], ['Skills', ['…']], ['Languages', ['…']]]], 'logic-right') },

  { id: 'project', title: 'Project Plan', description: '', category: 'Project Management', make: () => doc(['Project', [
    ['Initiation', [['Goals', [], { task: { done: false } }], ['Stakeholders', [], { task: { done: false } }]]],
    ['Planning', [['Scope', [], { task: { done: false } }], ['Budget', [], { task: { done: false } }], ['Timeline', [], { task: { done: false } }]]],
    ['Execution', [['Task 1', [], { task: { done: false } }], ['Task 2', [], { task: { done: false } }]]],
    ['Monitoring', ['Metrics', 'Risks']], ['Closure', ['Results', 'Lessons Learned']]]], 'logic-right') },
  { id: 'roadmap', title: 'Roadmap', description: '', category: 'Project Management', make: () => doc(['Roadmap', [
    ['Q1', ['Goal']], ['Q2', ['Goal']], ['Q3', ['Goal']], ['Q4', ['Goal']]]], 'timeline-h') },
  { id: 'software', title: 'Software Development', description: '', category: 'Project Management', make: () => doc(['Product', [
    ['Requirements', ['…']], ['Design', ['…']], ['Development', ['Backend', 'Frontend']], ['Testing', ['…']], ['Release', ['…']]]], 'org-down') },
  { id: 'orgchart', title: 'Company Structure', description: '', category: 'Project Management', make: () => doc(['CEO', [
    ['Department 1', ['Employee', 'Employee']], ['Department 2', ['Employee']], ['Department 3', ['Employee', 'Employee']]]], 'org-down') },

  { id: 'shopping', title: 'Shopping List', description: '', category: 'Life', make: () => doc(['Shopping', [
    ['Groceries', [['Milk', [], { task: { done: false } }], ['Bread', [], { task: { done: false } }]]], ['Home', ['…']], ['Pharmacy', ['…']]]], 'mindmap-cw') },
  { id: 'travel', title: 'Trip', description: '', category: 'Life', make: () => doc(['Trip', [
    ['Tickets', ['…']], ['Accommodation', ['…']], ['Itinerary', ['Day 1', 'Day 2']], ['Packing List', ['…']], ['Budget', ['…']]]], 'mindmap-cw') },
  { id: 'goals', title: 'Yearly Goals', description: '', category: 'Life', make: () => doc(['Yearly Goals', [
    ['Health', ['…']], ['Work', ['…']], ['Finance', ['…']], ['Relationships', ['…']], ['Hobbies', ['…']]]], 'mindmap') },

  { id: 'swot', title: 'SWOT Analysis', description: '', category: 'Analysis & Decisions', make: () => doc(['SWOT Analysis', [
    ['Strengths', ['…']], ['Weaknesses', ['…']], ['Opportunities', ['…']], ['Threats', ['…']]]], 'mindmap-cw') },
  { id: 'causes', title: 'Cause Analysis', description: '', category: 'Analysis & Decisions', make: () => doc(['Problem', [
    ['People', ['…']], ['Process', ['…']], ['Equipment', ['…']], ['Materials', ['…']], ['Environment', ['…']], ['Measurement', ['…']]]], 'fishbone-right') },
  { id: 'decision', title: 'Decision Making', description: '', category: 'Analysis & Decisions', make: () => doc(['Decision', [
    ['Option A', [['Pros', ['…']], ['Cons', ['…']]]], ['Option B', [['Pros', ['…']], ['Cons', ['…']]]], ['Criteria', ['Cost', 'Timeline', 'Risks']]]], 'mindmap') },
  { id: 'vs', title: 'Comparison', description: '', category: 'Analysis & Decisions', make: () => doc(['A vs B', [
    ['A', ['Pros', 'Cons']], ['B', ['Pros', 'Cons']]]], 'mindmap') },
]
