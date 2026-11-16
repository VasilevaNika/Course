import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { allTopics, BADGE_DIR, content, groupMaterials, RARITIES, type Material } from './content';

describe('ачивки в roadmap.json', () => {
  const dir = resolve(__dirname, '../../public', BADGE_DIR);

  it('у каждой ачивки есть редкость bronze | silver | epic | legendary', () => {
    for (const a of content.achievements) expect(RARITIES, a.id).toContain(a.rarity);
  });

  it('новая ачивка = новый SVG: у каждой ачивки есть иконка, у каждой иконки — ачивка', () => {
    const ids = content.achievements.map((a) => a.id);
    for (const id of ids) expect(existsSync(resolve(dir, `${id}.svg`)), `нет иконки ${BADGE_DIR}${id}.svg`).toBe(true);
    const files = readdirSync(dir).filter((f) => f.endsWith('.svg')).map((f) => f.slice(0, -4));
    expect(files.filter((f) => !ids.includes(f)), 'иконки без ачивки').toEqual([]);
  });

  it('id ачивок уникальны', () => {
    const ids = content.achievements.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

const m = (type: string, title: string, lang: 'ru' | 'en'): Material => ({ type, title, lang, url: `https://x/${title}` });

describe('groupMaterials', () => {
  it('группы в фиксированном порядке, внутри — сначала русские, исходные индексы сохранены', () => {
    const list = [
      m('книга', 'book-en', 'en'),
      m('видео', 'video-en', 'en'),
      m('статья', 'art-en', 'en'),
      m('статья', 'art-ru', 'ru'),
      m('док', 'doc-ru', 'ru'),
      m('видео', 'video-ru', 'ru'),
      m('практика', 'pr-en', 'en'),
      m('статья', 'art-ru-2', 'ru'),
    ];
    const groups = groupMaterials(list);
    expect(groups.map((g) => g.label)).toEqual(['Статьи', 'Видео', 'Документация', 'Практика', 'Книги']);
    expect(groups[0].items.map((i) => [i.material.title, i.index])).toEqual([
      ['art-ru', 3],
      ['art-ru-2', 7],
      ['art-en', 2],
    ]);
    expect(groups[1].items.map((i) => i.material.title)).toEqual(['video-ru', 'video-en']);
  });

  it('неизвестный тип идёт в конец под своим именем', () => {
    const groups = groupMaterials([m('подкаст', 'p', 'ru'), m('статья', 'a', 'ru')]);
    expect(groups.map((g) => g.label)).toEqual(['Статьи', 'подкаст']);
  });

  it('ни один материал не теряется и не дублируется', () => {
    for (const t of allTopics) {
      const idx = groupMaterials(t.materials).flatMap((g) => g.items.map((i) => i.index));
      expect(idx.sort((a, b) => a - b)).toEqual(t.materials.map((_, i) => i));
    }
  });
});

describe('материалы в roadmap.json', () => {
  it('у каждого материала есть lang ru|en, известный type и https-ссылка', () => {
    const types = new Set(['статья', 'видео', 'док', 'практика', 'книга']);
    for (const t of allTopics)
      for (const mat of t.materials) {
        expect(['ru', 'en'], `${t.id}: ${mat.title}`).toContain(mat.lang);
        expect(types.has(mat.type), `${t.id}: ${mat.type}`).toBe(true);
        expect(mat.url.startsWith('https://'), `${t.id}: ${mat.url}`).toBe(true);
      }
  });
});
