import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { useProgress } from '../ProgressContext';
import { content, kindLabel } from '../lib/content';
import { isExamPassed, missingRequirements } from '../lib/exam';
import { laneX, mapItems, smoothPath, type MapItem, type Point } from '../lib/mapLayout';
import type { Progress } from '../lib/progress';
import { prefersReducedMotion } from '../lib/confetti';

type NodeState = 'done' | 'current' | 'review' | 'todo' | 'locked';

const items = mapItems(content);

function itemState(item: MapItem, p: Progress, currentKey: string | undefined, review: Set<string>): NodeState {
  if (item.kind === 'topic') {
    if (itemKey(item) === currentKey) return 'current';
    if (!p.topics[item.topic.id]) return 'todo';
    return review.has(item.topic.id) ? 'review' : 'done';
  }
  if (item.kind === 'boss') {
    if (isExamPassed(p, item.exam.id)) return 'done';
    if (missingRequirements(p, item.exam).length) return 'locked';
    return itemKey(item) === currentKey ? 'current' : 'todo';
  }
  return 'todo';
}

function itemKey(item: MapItem): string {
  return item.kind === 'block' ? `b:${item.block.id}` : item.kind === 'topic' ? `t:${item.topic.id}` : `x:${item.exam.id}`;
}

/** Первая непройденная точка (тема или доступный босс) — «ты здесь». */
function currentItem(p: Progress): MapItem | undefined {
  return items.find(
    (it) =>
      (it.kind === 'topic' && !p.topics[it.topic.id]) ||
      (it.kind === 'boss' && !isExamPassed(p, it.exam.id) && !missingRequirements(p, it.exam).length),
  );
}

export const MAP_CURRENT_ID = 'map-current';

export default function RoadMap({ review }: { review: string[] }) {
  const { progress } = useProgress();
  const wrapRef = useRef<HTMLDivElement>(null);
  const donePathRef = useRef<SVGPathElement>(null);
  const [points, setPoints] = useState<Point[]>([]);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [doneLen, setDoneLen] = useState(0);
  const reviewSet = useMemo(() => new Set(review), [review]);
  const current = currentItem(progress);
  const currentKey = current ? itemKey(current) : undefined;

  // Шаг змейки: считаем только точки (темы и боссы), локации стоят по центру.
  let step = 0;
  const lanes = items.map((it) => (it.kind === 'block' ? 0.5 : laneX(step++)));

  // Пройденная часть дороги: до «ты здесь» или весь путь до финиша, если всё пройдено.
  const currentIdx = current ? items.indexOf(current) : items.length;

  // Измеряем реальные центры точек после раскладки — высоты локаций зависят от текста.
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const measure = () => {
      const box = wrap.getBoundingClientRect();
      const anchors = wrap.querySelectorAll<HTMLElement>('[data-anchor]');
      const pts: Point[] = [];
      anchors.forEach((el) => {
        const r = el.getBoundingClientRect();
        pts.push({ x: r.left - box.left + r.width / 2, y: r.top - box.top + r.height / 2 });
      });
      setPoints(pts);
      setSize({ w: box.width, h: wrap.scrollHeight });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(wrap);
    document.fonts?.ready.then(measure).catch(() => {});
    return () => ro.disconnect();
  }, [progress]);

  useEffect(() => {
    if (donePathRef.current) setDoneLen(donePathRef.current.getTotalLength());
  }, [points, currentIdx]);

  // Точки появляются по мере прокрутки.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const els = wrap.querySelectorAll<HTMLElement>('.reveal');
    if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('is-visible'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries)
          if (e.isIntersecting) {
            e.target.classList.add('is-visible');
            io.unobserve(e.target);
          }
      },
      { rootMargin: '0px 0px -8% 0px' },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const fullD = smoothPath(points);
  const doneD = smoothPath(points.slice(0, currentIdx + 1));

  return (
    <div className="roadmap" ref={wrapRef}>
      {size.w > 0 && (
        <svg className="roadmap__svg" width={size.w} height={size.h} viewBox={`0 0 ${size.w} ${size.h}`} aria-hidden>
          <path d={fullD} className="road road--base" />
          <path d={fullD} className="road road--dash" />
          <path
            ref={donePathRef}
            d={doneD}
            className="road road--done"
            style={{ '--len': doneLen } as CSSProperties}
            key={doneLen > 0 ? `done-${currentIdx}` : 'done-init'}
          />
        </svg>
      )}

      {items.map((item, i) => {
        const x = lanes[i];
        if (item.kind === 'block') return <BlockBanner key={itemKey(item)} item={item} progress={progress} />;
        const state = itemState(item, progress, currentKey, reviewSet);
        const side = x > 0.5 ? 'left' : 'right';
        return (
          <div
            key={itemKey(item)}
            className={`map-row map-row--${item.kind} reveal`}
            style={{ '--x': x } as CSSProperties}
            id={state === 'current' ? MAP_CURRENT_ID : undefined}
          >
            {item.kind === 'topic' ? (
              <TopicNode item={item} state={state} side={side} progress={progress} />
            ) : (
              <BossNode item={item} state={state} side={side} progress={progress} />
            )}
          </div>
        );
      })}
      <div className="map-finish reveal" data-anchor>
        <span>Junior Data Engineer</span>
      </div>
    </div>
  );
}

function BlockBanner({ item, progress }: { item: Extract<MapItem, { kind: 'block' }>; progress: Progress }) {
  const { block, index } = item;
  const done = block.topics.filter((t) => progress.topics[t.id]).length;
  const total = block.topics.length;
  const cleared = done === total;
  return (
    <section className={`map-banner reveal ${cleared ? 'map-banner--cleared' : ''}`} id={`block-${block.id}`}>
      <span className="map-banner__anchor" data-anchor />
      <div className="map-banner__top">
        <span className="map-banner__num">Локация {index + 1}</span>
        <span className={`badge badge--${block.kind}`}>{kindLabel[block.kind]}</span>
        {cleared && <span className="pill pill--ok">зачищена</span>}
      </div>
      <h2 className="map-banner__title">{block.title}</h2>
      <p className="muted small map-banner__desc">{block.description}</p>
      <div className="pbar">
        <div className="pbar__track">
          <div className="pbar__fill" style={{ width: `${(done / total) * 100}%` }} />
        </div>
        <span className="pbar__label">
          {done}/{total}
        </span>
      </div>
    </section>
  );
}

const CHECK = (
  <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden>
    <path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const LOCK = (
  <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden>
    <rect x="5" y="11" width="14" height="10" rx="2" fill="currentColor" />
    <path d="M8 11V8a4 4 0 018 0v3" fill="none" stroke="currentColor" strokeWidth="2.4" />
  </svg>
);
const SWORDS = (
  <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden>
    <path
      d="M4 4l9 9M20 4l-9 9M6.5 15.5l2 2M17.5 15.5l-2 2M4 20l3.5-3.5M20 20l-3.5-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
    />
  </svg>
);
const CROWN = (
  <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden>
    <path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5L3 8z" fill="currentColor" />
  </svg>
);

const STATE_TEXT: Record<NodeState, string> = {
  done: 'пройдена',
  current: 'ты здесь',
  review: 'пора повторить',
  todo: 'впереди',
  locked: 'закрыт',
};

function TopicNode({
  item,
  state,
  side,
  progress,
}: {
  item: Extract<MapItem, { kind: 'topic' }>;
  state: NodeState;
  side: 'left' | 'right';
  progress: Progress;
}) {
  const { topic } = item;
  const best = progress.topics[topic.id]?.best;
  return (
    <Link
      to={`/topic/${topic.id}`}
      className={`map-node map-node--${state} map-node--label-${side}`}
      aria-label={`${topic.title}: ${STATE_TEXT[state]}`}
    >
      <span className="map-node__dot" data-anchor>
        {state === 'done' || state === 'review' ? CHECK : <span className="map-node__num">{item.order}</span>}
        {state === 'current' && <span className="map-node__pulse" aria-hidden />}
        {state === 'review' && <span className="map-node__flag" aria-hidden>↻</span>}
      </span>
      <span className="map-node__label">
        {state === 'current' && <span className="map-node__here">Ты здесь</span>}
        <span className="map-node__title">{topic.title}</span>
        <span className="map-node__meta">
          {state === 'done' || state === 'review' ? `${STATE_TEXT[state]} · ${best}/3` : `~${topic.minutes} мин`}
          {topic.new && <span className="tag">новое</span>}
        </span>
      </span>
    </Link>
  );
}

function BossNode({
  item,
  state,
  side,
  progress,
}: {
  item: Extract<MapItem, { kind: 'boss' }>;
  state: NodeState;
  side: 'left' | 'right';
  progress: Progress;
}) {
  const { exam } = item;
  const st = progress.exams[exam.id];
  const isFinal = exam.id === 'final';
  const meta =
    state === 'done'
      ? `повержен · ${Math.round((st?.best ?? 0) * 100)}%`
      : state === 'locked'
        ? 'сначала победи остальных'
        : st
          ? `лучший результат ${Math.round(st.best * 100)}%`
          : `${exam.mcq} вопросов · порог ${Math.round(exam.pass * 100)}%`;
  const inner = (
    <>
      <span className={`boss-node__shape ${isFinal ? 'boss-node__shape--final' : ''}`} data-anchor>
        {state === 'locked' ? LOCK : state === 'done' ? CHECK : isFinal ? CROWN : SWORDS}
        {state === 'current' && <span className="map-node__pulse map-node__pulse--boss" aria-hidden />}
      </span>
      <span className="map-node__label">
        <span className="map-node__here map-node__here--boss">{isFinal ? 'Финальный босс' : 'Босс'}</span>
        <span className="map-node__title">{exam.title.replace(/^(Финальный босс|Босс):\s*/, '')}</span>
        <span className="map-node__meta">{meta}</span>
      </span>
    </>
  );
  const cls = `map-node boss-node boss-node--${state} map-node--label-${side}`;
  return state === 'locked' ? (
    <div className={cls} aria-label={`${exam.title}: закрыт`}>
      {inner}
    </div>
  ) : (
    <Link to={`/exam/${exam.id}`} className={cls} aria-label={`${exam.title}: ${STATE_TEXT[state]}`}>
      {inner}
    </Link>
  );
}
