import raw from '../../content/roadmap.json';

export type MaterialLang = 'ru' | 'en';

export type Material = { type: string; title: string; url: string; lang: MaterialLang };

/** В JSON правильный ответ всегда options[0]. */
export type QuizQuestion = { q: string; options: string[]; explain: string };

export type Topic = {
  id: string;
  title: string;
  new?: boolean;
  minutes: number;
  recap: string[];
  materials: Material[];
  quiz: QuizQuestion[];
};

export type BlockKind = 'repeat' | 'new' | 'mixed';

export type Block = {
  id: string;
  title: string;
  kind: BlockKind;
  description: string;
  topics: Topic[];
};

export type OpenQuestion = { block: string; q: string; key: string[] };

export type Exam = {
  id: string;
  title: string;
  blocks: string[];
  open_blocks: string[];
  mcq: number;
  open: number;
  pass: number;
  requires?: string[];
};

export type Achievement = {
  id: string;
  title: string;
  condition: string;
  reward: string;
  /** Ачивка за блок: открывается, когда пройдены все темы этого блока. */
  block?: string;
};

export type Content = {
  meta: { title: string; learner: string; goal: string; note: string };
  blocks: Block[];
  open_questions: OpenQuestion[];
  exams: Exam[];
  achievements: Achievement[];
};

export const content = raw as Content;

/** Все темы в порядке обучения: блок за блоком, тема за темой. */
export const allTopics: Topic[] = content.blocks.flatMap((b) => b.topics);

const topicIndex = new Map<string, { topic: Topic; block: Block }>();
for (const block of content.blocks) {
  for (const topic of block.topics) topicIndex.set(topic.id, { topic, block });
}

export function findTopic(id: string): { topic: Topic; block: Block } | undefined {
  return topicIndex.get(id);
}

/** Порядок и подписи групп материалов на странице темы. Неизвестные типы идут в конец под своим именем. */
const MATERIAL_GROUPS: [type: string, label: string][] = [
  ['статья', 'Статьи'],
  ['видео', 'Видео'],
  ['док', 'Документация'],
  ['практика', 'Практика'],
  ['книга', 'Книги'],
];

export type MaterialGroup = {
  type: string;
  label: string;
  /** index — позиция в topic.materials: по ней хранится отметка «открыто» (`${topicId}:${index}`). */
  items: { material: Material; index: number }[];
};

/** Группирует материалы по type; внутри группы сначала русские, порядок из JSON сохраняется. */
export function groupMaterials(materials: Material[]): MaterialGroup[] {
  const known = new Map(MATERIAL_GROUPS);
  const byType = new Map<string, MaterialGroup['items']>();
  materials.forEach((material, index) => {
    const list = byType.get(material.type) ?? [];
    list.push({ material, index });
    byType.set(material.type, list);
  });
  const order = [
    ...MATERIAL_GROUPS.map(([t]) => t).filter((t) => byType.has(t)),
    ...[...byType.keys()].filter((t) => !known.has(t)),
  ];
  const rank = (m: Material) => (m.lang === 'en' ? 1 : 0);
  return order.map((type) => ({
    type,
    label: known.get(type) ?? type,
    items: [...byType.get(type)!].sort((a, b) => rank(a.material) - rank(b.material) || a.index - b.index),
  }));
}

export const kindLabel: Record<BlockKind, string> = {
  repeat: 'повторение',
  new: 'новое',
  mixed: 'повторение + новое',
};
