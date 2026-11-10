import raw from '../../content/roadmap.json';

export type Material = { type: string; title: string; url: string };

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

export const kindLabel: Record<BlockKind, string> = {
  repeat: 'повторение',
  new: 'новое',
  mixed: 'повторение + новое',
};
