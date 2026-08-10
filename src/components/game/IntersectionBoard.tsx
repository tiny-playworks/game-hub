import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface IntersectionBoardProps {
  cols: number;
  rows: number;
  /** 单格边长，传 CSS 长度（建议用 clamp() 做响应式） */
  cell: string;
  /** 交叉点点击 */
  onPointClick?: (row: number, col: number) => void;
  isPointDisabled?: (row: number, col: number) => boolean;
  /** 无障碍名称，例如「天元，可落子」 */
  pointLabel: (row: number, col: number) => string;
  /** 交叉点上渲染的内容（棋子、落点提示等） */
  renderPoint: (row: number, col: number) => ReactNode;
  /** 画在网格线之上、棋子之下的装饰：星位、楚河汉界文字等 */
  decorations?: ReactNode;
  /**
   * 自定义线条层，坐标系为 viewBox="0 0 cols-1 rows-1"（1 单位 = 1 格）。
   * 象棋需要河界断线和九宫斜线，用它替代默认的等距网格。
   */
  underlay?: ReactNode;
  /** 关掉默认的 CSS 等距网格线（配合 underlay 使用） */
  showGridLines?: boolean;
  /** 画在棋子之上的图层：胜利连线等。坐标系同 underlay */
  overlay?: ReactNode;
  lineColor?: string;
  className?: string;
}

/**
 * 交叉点棋盘：围棋、五子棋、象棋的棋子落在网格线交点上，而不是格子里。
 * 网格线由 CSS 重复渐变绘制，交叉点是绝对定位的按钮，因此天然支持
 * 通过 `--cell` 做无级缩放，不需要为移动端另写一套尺寸。
 */
export const IntersectionBoard = ({
  cols,
  rows,
  cell,
  onPointClick,
  isPointDisabled,
  pointLabel,
  renderPoint,
  decorations,
  underlay,
  showGridLines = true,
  overlay,
  lineColor,
  className,
}: IntersectionBoardProps) => {
  const boardStyle = {
    '--cell': cell,
    '--line-color': lineColor,
    padding: 'calc(var(--cell) * 0.62)',
  } as CSSProperties;

  const innerStyle: CSSProperties = {
    width: `calc(${cols - 1} * var(--cell))`,
    height: `calc(${rows - 1} * var(--cell))`,
  };

  const points: ReactNode[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const disabled = isPointDisabled?.(row, col) ?? false;
      points.push(
        <button
          key={`${row}-${col}`}
          type="button"
          disabled={disabled}
          aria-label={pointLabel(row, col)}
          onClick={() => onPointClick?.(row, col)}
          style={{
            left: `calc(${col} * var(--cell))`,
            top: `calc(${row} * var(--cell))`,
            width: 'var(--cell)',
            height: 'var(--cell)',
          }}
          className="group absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:cursor-default"
        >
          {renderPoint(row, col)}
        </button>,
      );
    }
  }

  return (
    <div
      className={cn('board-wood relative rounded-xl sm:rounded-2xl', className)}
      style={boardStyle}
    >
      <div className="relative" style={innerStyle}>
        {showGridLines && (
          <div
            className="board-grid-lines"
            style={{
              left: 0,
              top: 0,
              width: `calc(${cols - 1} * var(--cell) + 1px)`,
              height: `calc(${rows - 1} * var(--cell) + 1px)`,
            }}
          />
        )}
        {underlay && (
          <BoardSvgLayer cols={cols} rows={rows}>
            {underlay}
          </BoardSvgLayer>
        )}
        {decorations}
        {points}
        {overlay && (
          <BoardSvgLayer cols={cols} rows={rows}>
            {overlay}
          </BoardSvgLayer>
        )}
      </div>
    </div>
  );
};

/** 与棋盘格点对齐的 SVG 图层，1 个 viewBox 单位 = 1 格 */
const BoardSvgLayer = ({
  cols,
  rows,
  children,
}: {
  cols: number;
  rows: number;
  children: ReactNode;
}) => (
  <svg
    role="presentation"
    className="pointer-events-none absolute"
    style={{
      left: 0,
      top: 0,
      width: `calc(${cols - 1} * var(--cell))`,
      height: `calc(${rows - 1} * var(--cell))`,
      overflow: 'visible',
    }}
    viewBox={`0 0 ${cols - 1} ${rows - 1}`}
    preserveAspectRatio="none"
  >
    {children}
  </svg>
);

/** 在棋盘坐标系里绝对定位一个装饰元素（居中于交叉点） */
export const pointStyle = (row: number, col: number): CSSProperties => ({
  position: 'absolute',
  left: `calc(${col} * var(--cell))`,
  top: `calc(${row} * var(--cell))`,
  transform: 'translate(-50%, -50%)',
});
