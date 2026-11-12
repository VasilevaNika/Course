import { describe, expect, it } from 'vitest';
import { content } from './content';
import { laneX, mapItems, smoothPath } from './mapLayout';

describe('mapItems', () => {
  const items = mapItems(content);
  const keys = items.map((i) => (i.kind === 'block' ? `B:${i.block.id}` : i.kind === 'boss' ? `X:${i.exam.id}` : 't'));

  it('все темы по порядку, каждая ровно один раз', () => {
    const topics = items.flatMap((i) => (i.kind === 'topic' ? [i.topic.id] : []));
    expect(topics).toEqual(content.blocks.flatMap((b) => b.topics.map((t) => t.id)));
    expect(items.filter((i) => i.kind === 'block')).toHaveLength(content.blocks.length);
  });

  it('босс стоит сразу после последнего нужного ему блока', () => {
    const order = keys.filter((k) => k !== 't');
    expect(order).toEqual([
      'B:py', 'B:sql', 'B:pg', 'X:boss-sql', 'B:be', 'B:inf', 'X:boss-backend', 'B:de', 'X:boss-de', 'B:int', 'X:final',
    ]);
  });

  it('у каждого босса все его блоки стоят на карте раньше него', () => {
    for (const exam of content.exams) {
      const at = keys.indexOf(`X:${exam.id}`);
      for (const b of exam.blocks) expect(keys.indexOf(`B:${b}`)).toBeLessThan(at);
    }
  });
});

describe('геометрия', () => {
  it('змейка остаётся внутри полосы', () => {
    for (let i = -3; i < 20; i++) {
      expect(laneX(i)).toBeGreaterThan(0.1);
      expect(laneX(i)).toBeLessThan(0.9);
    }
  });

  it('путь проходит через все точки', () => {
    expect(smoothPath([])).toBe('');
    const d = smoothPath([{ x: 10, y: 0 }, { x: 90, y: 100 }]);
    expect(d.startsWith('M 10.0 0.0')).toBe(true);
    expect(d.endsWith('90.0 100.0')).toBe(true);
  });
});
