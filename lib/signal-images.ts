// 審判シグナル画像のマッピング

export interface SignalImage {
  id: string;
  name: string;
  path: string;
  keywords: string[];
  relatedSections: string[];
  description: string;
}

export const signalImages: SignalImage[] = [
  {
    id: 'one-point',
    name: '1点（得点）',
    path: '/images/signals/01-one-point.png',
    keywords: ['1点', '得点', 'フリースロー', 'ワンポイント'],
    relatedSections: ['第16条', '第43条'],
    description: '1本指で手首から振り動かす'
  },
  {
    id: 'two-points',
    name: '2点（得点）',
    path: '/images/signals/02-two-points.png',
    keywords: ['2点', '得点', 'ツーポイント'],
    relatedSections: ['第16条'],
    description: '2本指で手首から振り動かす'
  },
  {
    id: 'three-points',
    name: '3点（得点）',
    path: '/images/signals/03-three-points.png',
    keywords: ['3点', '得点', 'スリーポイント', '3ポイント'],
    relatedSections: ['第16条'],
    description: '3本指で腕を伸ばす'
  },
  {
    id: 'stop-clock',
    name: 'ゲームクロックを止める',
    path: '/images/signals/04-stop-clock.png',
    keywords: ['ゲームクロック', '止める', 'ストップ', '時計'],
    relatedSections: ['第47条'],
    description: '手のひらを開く'
  },
  {
    id: 'stop-clock-for-foul',
    name: 'ファウルでゲームクロックを止める',
    path: '/images/signals/05-stop-clock-for-foul.png',
    keywords: ['ファウル', 'ゲームクロック', '止める'],
    relatedSections: ['第47条'],
    description: '片手の心を握る'
  },
  {
    id: 'start-clock',
    name: 'ゲームクロックを動かす',
    path: '/images/signals/06-start-clock.png',
    keywords: ['ゲームクロック', '動かす', 'スタート', '時計'],
    relatedSections: ['第47条'],
    description: '手を振り下ろす'
  },
  {
    id: 'substitution',
    name: '交代',
    path: '/images/signals/07-substitution.png',
    keywords: ['交代', 'サブスティテューション', '選手交代'],
    relatedSections: ['第19条'],
    description: '前腕を交差'
  },
  {
    id: 'beckoning',
    name: '招き入れる',
    path: '/images/signals/08-beckoning.png',
    keywords: ['招き入れる', '入場', 'ベックニング'],
    relatedSections: ['第19条'],
    description: '手のひらを開いて、自分に向けて動かす'
  },
  {
    id: 'timeout',
    name: 'タイムアウト',
    path: '/images/signals/09-timeout.png',
    keywords: ['タイムアウト', 'TO', '休憩'],
    relatedSections: ['第18条'],
    description: 'Tの形を大人差し指で示す'
  },
  {
    id: 'media-timeout',
    name: 'メディアタイムアウト',
    path: '/images/signals/10-media-timeout.png',
    keywords: ['メディアタイムアウト', 'メディア', 'タイムアウト'],
    relatedSections: ['別添資料E'],
    description: '腕ひらきして頭越しに広げる'
  },
  {
    id: 'cancel-score',
    name: 'スコアのキャンセル、プレーのキャンセル',
    path: '/images/signals/11-cancel-score.png',
    keywords: ['キャンセル', 'スコア', 'プレー', '取り消し'],
    relatedSections: ['第47条'],
    description: '腕の前で両腕を交差させる動作を1回'
  },
  {
    id: 'visible-count',
    name: 'ビジブルカウント',
    path: '/images/signals/12-visible-count.png',
    keywords: ['ビジブルカウント', 'カウント', '秒数', '5秒'],
    relatedSections: ['第27条', '第47条'],
    description: '手のひらを動かしてカウントする'
  },
  {
    id: 'communication',
    name: 'コミュニケーション',
    path: '/images/signals/13-communication.png',
    keywords: ['コミュニケーション', '親指', 'サムアップ'],
    relatedSections: ['第47条'],
    description: '片手の親指を立てて示す'
  },
  {
    id: 'shot-clock-reset',
    name: 'ショットクロックのリセット',
    path: '/images/signals/14-shot-clock-reset.png',
    keywords: ['ショットクロック', 'リセット', '24秒', '14秒'],
    relatedSections: ['第29条', '第50条'],
    description: '人差し指を伸ばして手を回す'
  },
  {
    id: 'direction',
    name: 'プレーやアウトオブバウンズの方向',
    path: '/images/signals/15-direction.png',
    keywords: ['方向', 'アウトオブバウンズ', 'プレー', '指示'],
    relatedSections: ['第23条', '第47条'],
    description: '腕はサイドラインと平行にプレーの方向を指す'
  },
  {
    id: 'held-ball',
    name: 'ヘルドボール／ジャンプボールシチュエーション',
    path: '/images/signals/16-held-ball.png',
    keywords: ['ヘルドボール', 'ジャンプボール', 'ジャンプ'],
    relatedSections: ['第12条'],
    description: '両手の親指を立てて'
  },
  {
    id: 'traveling',
    name: 'トラベリング',
    path: '/images/signals/17-traveling.png',
    keywords: ['トラベリング', 'トラベル', '歩く', '違反', 'バイオレーション'],
    relatedSections: ['第25条'],
    description: '両こぶしを回す'
  },
  {
    id: 'double-dribble',
    name: 'イリーガルドリブル（ダブルドリブル）',
    path: '/images/signals/18-double-dribble.png',
    keywords: ['ダブルドリブル', 'イリーガルドリブル', 'ドリブル', '違反'],
    relatedSections: ['第24条'],
    description: '手のひらを交互に回す'
  },
  {
    id: 'carrying',
    name: 'イリーガルドリブル（キャリイングボール）',
    path: '/images/signals/19-carrying.png',
    keywords: ['キャリイング', 'キャリー', 'イリーガルドリブル', 'ドリブル'],
    relatedSections: ['第24条'],
    description: '手のひらを半回転させる'
  },
  {
    id: 'three-seconds',
    name: '3秒',
    path: '/images/signals/20-three-seconds.png',
    keywords: ['3秒', '3秒ルール', 'スリーセカンド', '制限区域'],
    relatedSections: ['第26条'],
    description: '3本指を足と腕を振る'
  },
  {
    id: 'five-seconds',
    name: '5秒',
    path: '/images/signals/21-five-seconds.png',
    keywords: ['5秒', '5秒ルール', 'ファイブセカンド'],
    relatedSections: ['第27条'],
    description: '5本指を見せる'
  },
  {
    id: 'eight-seconds',
    name: '8秒',
    path: '/images/signals/22-eight-seconds.png',
    keywords: ['8秒', '8秒ルール', 'エイトセカンド', 'バックコート'],
    relatedSections: ['第28条'],
    description: '8本指を見せる'
  },
  {
    id: 'shot-clock',
    name: 'ショットクロック',
    path: '/images/signals/23-shot-clock.png',
    keywords: ['ショットクロック', '24秒', 'バイオレーション'],
    relatedSections: ['第29条', '第50条'],
    description: '指で肩に触れる'
  },
  {
    id: 'backcourt',
    name: 'ボールをバックコートに返すこと（バックコートバイオレーション）',
    path: '/images/signals/24-backcourt.png',
    keywords: ['バックコート', 'バイオレーション', 'バックコートバイオレーション', '8秒'],
    relatedSections: ['第30条'],
    description: '体の前で腕を振る'
  },
  {
    id: 'kicked-ball',
    name: 'わざとボールを蹴ったり、止めたりする',
    path: '/images/signals/25-kicked-ball.png',
    keywords: ['蹴る', 'キック', 'ボール', 'バイオレーション'],
    relatedSections: ['第22条'],
    description: '足を指す'
  },
  {
    id: 'goaltending',
    name: 'ゴールテンディング／インタフェアレンス',
    path: '/images/signals/26-goaltending.png',
    keywords: ['ゴールテンディング', 'インタフェアレンス', 'バイオレーション', 'ゴール'],
    relatedSections: ['第31条'],
    description: '伸ばした人差し指でバスケットを作ったもう一方の手の上で回す'
  }
];

// キーワードで画像を検索
export function searchSignalImages(question: string): SignalImage[] {
  const results: Array<{ image: SignalImage; score: number }> = [];
  
  signalImages.forEach(image => {
    let score = 0;
    
    // キーワードマッチ
    image.keywords.forEach(keyword => {
      if (question.includes(keyword)) {
        score += 10;
      }
    });
    
    // 名前マッチ
    if (question.includes(image.name)) {
      score += 20;
    }
    
    if (score > 0) {
      results.push({ image, score });
    }
  });
  
  // スコア順にソート
  results.sort((a, b) => b.score - a.score);
  
  // 上位3件まで返す
  return results.slice(0, 3).map(r => r.image);
}