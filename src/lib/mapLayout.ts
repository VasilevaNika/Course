// Раскладка карты-дорожки: в каком порядке идут локации, темы и боссы. Чистые функции.
import type { Block, Content, Exam, Topic } from './content';

export type MapItem =
  | { kind: 'block'; block: Block; index: number }
  | { kind: 'topic'; topic: Topic; block: Block; order: number }
  | { kind: 'boss'; exam: Exam };

/**
 * Последовательность точек на карте: локация → её темы → боссы, для которых это был
 * последний нужный блок (по порядку обучения). Так босс стоит сразу там, где его уже можно бить.
 */
export function mapItems(content: Content): MapItem[] {
  const blockOrder = new Map(content.blocks.map((b, i) => [b.id, i]));
  const bossesAfter = new Map<number, Exam[]>();
  for (const exam of content.exams) {
    const idx = Math.max(...exam.blocks.map((b) => blockOrder.get(b) ?? -1));
    if (idx < 0) continue;
    bossesAfter.set(idx, [...(bossesAfter.get(idx) ?? []), exam]);
  }

  const items: MapItem[] = [];
  let order = 0;
  content.blocks.forEach((block, index) => {
    items.push({ kind: 'block', block, index });
    for (const topic of block.topics) items.push({ kind: 'topic', topic, block, order: ++order });
    for (const exam of bossesAfter.get(index) ?? []) items.push({ kind: 'boss', exam });
  });
  return items;
}

/** Горизонтальная позиция (0..1) точки: змейка центр → право → центр → лево. */
export function laneX(step: number): number {
  const lanes = [0.5, 0.76, 0.5, 0.24];
  return lanes[((step % lanes.length) + lanes.length) % lanes.length];
}

export type Point = { x: number; y: number };

/** Плавная S-кривая через точки (кубические Безье с вертикальными касательными). */
export function smoothPath(points: Point[]): string {
  if (!points.length) return '';
  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const dy = (b.y - a.y) / 2;
    d += ` C ${a.x.toFixed(1)} ${(a.y + dy).toFixed(1)}, ${b.x.toFixed(1)} ${(b.y - dy).toFixed(1)}, ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
  }
  return d;
}
