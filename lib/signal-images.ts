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
  },
  {
    id: 'hitting-head',
    name: '頭をたたく',
    path: '/images/signals/27-hitting-head.png',
    keywords: ['頭', 'たたく', 'ファウル', 'ヘッド'],
    relatedSections: ['第33条', '第37条'],
    description: '頭に触れる または 頭をたたく'
  },
  {
    id: 'team-control-foul',
    name: 'ボールをコントロールしているチームのファウル',
    path: '/images/signals/28-team-control-foul.png',
    keywords: ['チームコントロール', 'オフェンスファウル', 'ファウル'],
    relatedSections: ['第33条'],
    description: '攻撃しているチームのバスケットへ腕と拳を突き出す'
  },
  {
    id: 'foul-in-act-of-shooting',
    name: 'ショットの動作中のプレーヤーへのファウル',
    path: '/images/signals/29-foul-in-act-of-shooting.png',
    keywords: ['ショット', 'シューティング', 'ファウル', 'アクトオブシューティング'],
    relatedSections: ['第33条', '第43条'],
    description: 'こぶしを握った片腕を肩したあと、フリースローの枚数を示す'
  },
  {
    id: 'foul-not-in-act-of-shooting',
    name: 'ショットの動作中ではないプレーヤーへのファウル',
    path: '/images/signals/30-foul-not-in-act-of-shooting.png',
    keywords: ['ファウル', 'プッシング', 'ブロッキング', 'ホールディング', 'チャージング'],
    relatedSections: ['第33条'],
    description: 'こぶしを握った片腕を肩したあと、コートを正しく指示する'
  },
  {
    id: 'pass-off',
    name: 'パス・オフ（ショットの動作中にファウルが起きたがファウルを受けたプレーヤーがパスをすること）',
    path: '/images/signals/31-pass-off.png',
    keywords: ['パスオフ', 'ファウル', 'パス'],
    relatedSections: ['第33条'],
    description: '手のひらを開いて両手を横に動かす'
  },
  {
    id: 'double-foul',
    name: 'ダブルファウル',
    path: '/images/signals/32-double-foul.png',
    keywords: ['ダブルファウル', 'ファウル', '同時'],
    relatedSections: ['第33条'],
    description: 'こぶしを握って上と両腕を振る'
  },
  {
    id: 'technical-foul',
    name: 'テクニカルファウル',
    path: '/images/signals/33-technical-foul.png',
    keywords: ['テクニカルファウル', 'テクニカル', 'T', 'ファウル'],
    relatedSections: ['第36条'],
    description: '両手でTを示す'
  },
  {
    id: 'unsportsmanlike-foul',
    name: 'アンスポーツマンライクファウル',
    path: '/images/signals/34-unsportsmanlike-foul.png',
    keywords: ['アンスポーツマンライクファウル', 'アンスポ', 'UF', 'ファウル'],
    relatedSections: ['第37条'],
    description: '手首を握って頭上に上げる'
  },
  {
    id: 'disqualifying-foul',
    name: 'ディスクォリファイングファウル',
    path: '/images/signals/35-disqualifying-foul.png',
    keywords: ['ディスクォリファイングファウル', 'DQ', 'ディスクォ', '失格', 'ファウル'],
    relatedSections: ['第38条'],
    description: '両手の腕の上こぶしを上に上げる'
  },
  {
    id: 'fake-foul',
    name: 'フェイクファウル',
    path: '/images/signals/36-fake-foul.png',
    keywords: ['フェイクファウル', 'フェイク', 'フロッピング', 'ファウル'],
    relatedSections: ['第33条'],
    description: '前腕を2度上げ下げる'
  },
  {
    id: 'illegal-boundary-crossing',
    name: 'イリーガルバウンダリラインクロッシング（アルベディンクシグナル）',
    path: '/images/signals/37-illegal-boundary-crossing.png',
    keywords: ['バウンダリライン', 'アルベディンク', 'イリーガル', 'クロッシング'],
    relatedSections: ['第23条'],
    description: '境界線を行ったり来たりする仕草を示す（指3本指を握る）2回目：投球と2：00'
  },
  {
    id: 'holding',
    name: 'ホールディング',
    path: '/images/signals/38-holding.png',
    keywords: ['ホールディング', 'ホールド', 'つかむ', 'ファウル'],
    relatedSections: ['第33条'],
    description: '手首を握って下げる'
  },
  {
    id: 'blocking-illegal-screen',
    name: 'ブロッキング（ディフェンス）、イリーガルスクリーン（オフェンス）',
    path: '/images/signals/39-blocking-illegal-screen.png',
    keywords: ['ブロッキング', 'イリーガルスクリーン', 'スクリーン', 'ファウル'],
    relatedSections: ['第33条'],
    description: '両手を腰に当てる'
  },
  {
    id: 'pushing-charging',
    name: 'プッシングまたはボールをコントロールしていないチャージング',
    path: '/images/signals/40-pushing-charging.png',
    keywords: ['プッシング', 'チャージング', 'ファウル', '押す'],
    relatedSections: ['第33条'],
    description: '押すまねをする'
  },
  {
    id: 'hand-checking',
    name: 'ハンドチェッキング',
    path: '/images/signals/41-hand-checking.png',
    keywords: ['ハンドチェッキング', 'ハンドチェック', 'ファウル'],
    relatedSections: ['第33条'],
    description: '手のひらを用いて腕を横に動かす'
  },
  {
    id: 'illegal-use-of-hands',
    name: 'イリーガルユース・オブ・ハンズ',
    path: '/images/signals/42-illegal-use-of-hands.png',
    keywords: ['イリーガルユースオブハンズ', 'ハンド', '手', 'ファウル'],
    relatedSections: ['第33条'],
    description: '手首をたたく'
  },
  {
    id: 'charging-with-ball',
    name: 'ボールをコントロールしているチャージング',
    path: '/images/signals/43-charging-with-ball.png',
    keywords: ['チャージング', 'チャージ', 'ファウル', 'オフェンスファウル'],
    relatedSections: ['第33条'],
    description: '握りこぶしで手のひらをたたく'
  },
  {
    id: 'illegal-contact-on-hand',
    name: '手に対するイリーガルコンタクト',
    path: '/images/signals/44-illegal-contact-on-hand.png',
    keywords: ['イリーガルコンタクト', '手', 'ハンド', 'ファウル'],
    relatedSections: ['第33条'],
    description: '手のひらをもう一方の前腕を叩く'
  },
  {
    id: 'pushing-foul',
    name: 'プッシング',
    path: '/images/signals/45-pushing.png',
    keywords: ['プッシング', '押す', 'ファウル'],
    relatedSections: ['第33条'],
    description: '腕を後ろに動かす'
  },
  {
    id: 'illegal-cylinder',
    name: 'イリーガルシリンダー',
    path: '/images/signals/46-illegal-cylinder.png',
    keywords: ['イリーガルシリンダー', 'シリンダー', 'ファウル'],
    relatedSections: ['第33条'],
    description: '手のひらを向かい合わせて縦に調整を通過させる'
  },
  {
    id: 'excessive-elbow-swing',
    name: '過度な肘の振り回し',
    path: '/images/signals/47-excessive-elbow-swing.png',
    keywords: ['肘', 'エルボー', 'ファウル', '振り回し'],
    relatedSections: ['第33条'],
    description: '肘を後ろに振る'
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