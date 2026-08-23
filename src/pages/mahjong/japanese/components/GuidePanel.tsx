import { X } from 'lucide-react';

type Props = {
  onClose: () => void;
};

const GUIDE_SECTIONS = [
  {
    eyebrow: '01 · 基础目标',
    title: '先组成能和的牌，再确认有役',
    items: [
      '通常牌型由四组面子与一组对子构成。',
      '只有牌型完整还不够，至少需要一个役。',
      '门前听牌可以立直；立直后手牌固定。',
    ],
  },
  {
    eyebrow: '02 · 桌面操作',
    title: '所有决策围绕牌桌底部完成',
    items: [
      '轮到自家时，点击一张手牌将其打出。',
      '吃、碰、杠、立直与和牌会出现在手牌上方。',
      '训练提示、上一局结算与日志位于右侧工具栏。',
    ],
  },
  {
    eyebrow: '03 · 关键限制',
    title: '注意振听、立直与宝牌的区别',
    items: [
      '振听状态不能荣和，但仍然可以自摸。',
      '宝牌只增加番数，本身不能作为起和役。',
      '赤五是宝牌；白板为空白蓝框，牌背不显示牌面。',
    ],
  },
];

export function GuidePanel({ onClose }: Props) {
  return (
    <div className="riichi-guide-panel">
      <header className="riichi-guide-header">
        <div>
          <p>RULES & ONBOARDING</p>
          <h2 id="guide-title">立直麻将规则与新人指南</h2>
          <span>在开始做牌前，先记住“有役才能和”这一条。</span>
        </div>
        <button type="button" onClick={onClose} aria-label="关闭规则">
          <X aria-hidden="true" size={22} />
        </button>
      </header>

      <div className="riichi-guide-grid">
        {GUIDE_SECTIONS.map((section) => (
          <section key={section.eyebrow}>
            <p>{section.eyebrow}</p>
            <h3>{section.title}</h3>
            <ul>
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <section className="riichi-guide-rules">
        <div>
          <h3>本项目当前采用的核心规则</h3>
          <p>
            四人麻将，136
            张牌，包含赤五万、赤五筒、赤五索各一枚。无役不能和；里宝牌仅在立直和牌时计算；开杠追加杠宝牌。
          </p>
        </div>
        <div>
          <h3>符番与打点</h3>
          <p>
            一般和牌最低 20 符，七对子固定 25 符。5 番、4 番 40 符以上或 3 番 70
            符以上为满贯；之后依次为跳满、倍满、三倍满与役满。
          </p>
        </div>
        <div>
          <h3>场次结束</h3>
          <p>
            东风场进行至东四局，南风场进行至南四局；连庄、本场、立直棒与击飞条件按牌局状态结算。
          </p>
        </div>
      </section>
    </div>
  );
}
