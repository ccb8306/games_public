import { z } from "zod";

export type AugmentDefinition = {
  id: string;
  name: string;
  rarity: "silver" | "gold" | "prism";
  description: string;
  details?: string[];
  trigger: "passive" | "active";
  charges: number;
  tags: string[];
  flash?: boolean;
  retired?: boolean;
};
export const FLASH_CHANCE: Record<number,number> = {1:8,4:12,7:14,10:12};
export const AUGMENTS: AugmentDefinition[] = [
  {
    "id": "nudge",
    "name": "손끝 보정",
    "description": "굴린 주사위 하나를 1 올리거나 내려요. 예: 4 → 3 또는 5. 1~6 안에서, 턴당 1회·게임당 3회.",
    "charges": 3,
    "tags": [
      "change"
    ],
    "rarity": "silver",
    "trigger": "active",
    "details": []
  },
  {
    "id": "mirror",
    "name": "거울 조각",
    "description": "굴린 주사위 하나를 뒤집어요. 1↔6, 2↔5, 3↔4로 바뀌어요. 게임당 3회.",
    "charges": 3,
    "tags": [
      "change"
    ],
    "rarity": "silver",
    "trigger": "active",
    "details": []
  },
  {
    "id": "cleaner",
    "name": "바닥 청소부",
    "description": "기록할 때 1이 2개 이상이면 +6점과 청소권! 다음 내 첫 굴림에서 1 하나를 무료로 다시 던질 수 있어요. 청소권은 보유 최대 1장·게임당 2장 발급, 마지막 턴 발급 없음.",
    "charges": -1,
    "tags": [
      "ones"
    ],
    "rarity": "silver",
    "trigger": "active",
    "details": [
      "자동 점수 보너스와 청소권은 별개입니다. 청소권을 다 써도 1 두 개 이상의 +6점은 계속 받습니다.",
      "청소권은 다음 내 턴까지만 쓸 수 있습니다. 사용하지 않고 기록하면 만료됩니다."
    ]
  },
  {
    "id": "collector",
    "name": "중복은 못 참지",
    "description": "중복된 눈 하나를 무료로 다시 던져요. 던지기 전에 없던 숫자가 나오면 별도 +2점(합계 최대 8점)! 새 결과 필수, 게임당 4회·턴당 1회.",
    "charges": 4,
    "tags": [
      "straight"
    ],
    "rarity": "silver",
    "trigger": "active",
    "details": []
  },
  {
    "id": "rest",
    "name": "얌체 휴식",
    "description": "한 번만 굴리고 기록하면 +6점, 두 번 굴렸으면 +3점. 세 번 이상 굴리면 보너스가 없어요. 무료 재굴림은 세지 않아요.",
    "charges": 0,
    "tags": [
      "early"
    ],
    "rarity": "silver",
    "trigger": "passive",
    "details": []
  },
  {
    "id": "stubborn",
    "name": "존버 금고",
    "description": "첫 굴림에서 보관한 주사위 2개 이상을 지킨 채 다시 굴릴 때마다 금고 +3점, 최대 +9점! 기록하면 받아요. 2개 미만으로 남기면 금고가 깨져요.",
    "charges": 0,
    "tags": [
      "hold"
    ],
    "rarity": "silver",
    "trigger": "passive",
    "details": []
  },
  {
    "id": "odd",
    "name": "홀수 왕국",
    "description": "기록할 때 홀수 주사위 4개 이상이면 별도 +6점! 덤으로 게임당 한 번, 짝수 주사위 하나를 1 내릴 수 있어요. 사용권을 써도 자동 보너스는 유지.",
    "charges": 1,
    "tags": [
      "odd"
    ],
    "rarity": "silver",
    "trigger": "active",
    "details": []
  },
  {
    "id": "even",
    "name": "불량품 반품",
    "description": "지금 나온 1을 전부 무료로 다시 던져요. 강제 고정은 제외하고 새 결과는 반드시 사용! 게임당 2회.",
    "charges": 2,
    "tags": [
      "roll"
    ],
    "rarity": "silver",
    "trigger": "active",
    "details": []
  },
  {
    "id": "clockwork",
    "name": "브레이크 고장",
    "description": "아무것도 보관하지 않고 전부 다시 굴릴수록 보상이 커져요! 1번 +4, 2번 +10, 3번 이상 +18점. 족보 1점 이상 기록 시 지급, 게임 전체 최대 +36점.",
    "charges": 0,
    "tags": [
      "gamble"
    ],
    "rarity": "silver",
    "trigger": "passive",
    "details": []
  },
  {
    "id": "upper",
    "name": "상단 후원자",
    "description": "상단 숫자 칸에 해당 숫자 3개 이상을 기록하면 별도 +4점! 서로 다른 상단 3칸에서 성공하면 추가 +12점 한 번. 보너스는 상단 63점 계산에서 제외.",
    "charges": 0,
    "tags": [
      "upper"
    ],
    "rarity": "silver",
    "trigger": "passive",
    "details": []
  },
  {
    "id": "lower",
    "name": "꽝 적립소",
    "description": "족보에 0점을 쓰면 즉시 별도 보너스 +8점! 마지막 턴에도 지급, 게임당 최대 3회.",
    "charges": 0,
    "tags": [
      "zero"
    ],
    "rarity": "silver",
    "trigger": "passive",
    "details": []
  },
  {
    "id": "savings",
    "name": "적금 만기",
    "description": "내 턴 3번 연속 족보에 1점 이상 기록하면 +18점! 지급 후 다시 도전, 최대 2번 지급. 중간에 0점이면 연속 기록은 처음부터.",
    "charges": 0,
    "tags": [
      "safe"
    ],
    "rarity": "silver",
    "trigger": "passive",
    "details": []
  },
  {
    "id": "lifebuoy",
    "name": "구명튜브",
    "description": "첫 일반 굴림 직후, 눈을 바꾸기 전에 전부 무료로 다시 던져요. 일반 보관은 풀리고 강제 고정·봉인은 유지! 새 결과 필수, 게임당 2회·턴당 1회.",
    "charges": 2,
    "tags": [
      "zero"
    ],
    "rarity": "silver",
    "trigger": "active",
    "details": []
  },
  {
    "id": "lastmove",
    "name": "퇴근 전 한 발",
    "description": "세 번째 일반 굴림 이후 주사위 하나를 무료로 다시 던져요. 새 결과 필수! 남은 일반 굴림이 있으면 계속 던질 수 있어요. 게임당 3회.",
    "charges": 3,
    "tags": [
      "roll"
    ],
    "rarity": "silver",
    "trigger": "active",
    "details": []
  },
  {
    "id": "six",
    "name": "6의 신봉자",
    "description": "기록할 때 6이 3개 이상이면 별도 +7점! 덤으로 게임당 한 번, 5 하나를 6으로 올릴 수 있어요. 사용권을 써도 자동 보너스는 유지.",
    "charges": 1,
    "tags": [
      "six"
    ],
    "rarity": "silver",
    "trigger": "active",
    "details": []
  },
  {
    "id": "spectator",
    "name": "남의 떡 구경",
    "description": "매 라운드 처음으로 상대가 기본 족보 20점 이상을 쓰면 나는 +4점! 라운드당 1회, 게임 전체 최대 28점.",
    "charges": 0,
    "tags": [
      "rival"
    ],
    "rarity": "silver",
    "trigger": "passive",
    "details": []
  },
  {
    "id": "shield",
    "name": "소형 방패",
    "description": "첫 방해를 자동으로 막고 +6점! 끝까지 방해를 받지 않으면 마지막 내 턴 종료 시 +8점.",
    "charges": 1,
    "tags": [
      "defense"
    ],
    "rarity": "silver",
    "trigger": "passive",
    "details": []
  },
  {
    "id": "underdog",
    "name": "언더독",
    "description": "선택 즉시 +8점! 내 턴 시작에 선두보다 낮고 공동 꼴찌 또는 단독 꼴찌라면 기록할 때 +4점. 추격 보너스 최대 20점, 모두 동점이면 발동하지 않아요.",
    "charges": 0,
    "tags": [
      "comeback"
    ],
    "rarity": "silver",
    "trigger": "passive",
    "details": []
  },
  {
    "id": "fourth",
    "name": "네 번째 기회",
    "description": "매 턴 일반 굴림이 1회 늘어나요. 기본 3회라면 4회까지 굴릴 수 있어요.",
    "charges": 0,
    "tags": [
      "roll"
    ],
    "rarity": "gold",
    "trigger": "passive",
    "details": []
  },
  {
    "id": "clone",
    "name": "복제술",
    "description": "내 주사위 하나의 눈을 다른 주사위에 복사해요. 예: 6·2 → 6·6. 턴당 1회·게임당 4회.",
    "charges": 4,
    "tags": [
      "change"
    ],
    "rarity": "gold",
    "trigger": "active",
    "details": []
  },
  {
    "id": "alchemy",
    "name": "주사위 연금술",
    "description": "굴린 주사위 하나를 원하는 숫자(1~6)로 바꿔요. 게임당 2회. 한 턴에 두 번 써도 돼요.",
    "charges": 2,
    "tags": [
      "change"
    ],
    "rarity": "gold",
    "trigger": "active",
    "details": []
  },
  {
    "id": "flip",
    "name": "양면 주사위",
    "description": "굴린 주사위 하나를 뒤집어요. 1↔6, 2↔5, 3↔4로 바뀌어요. 매 턴 1회.",
    "charges": -1,
    "tags": [
      "change"
    ],
    "rarity": "gold",
    "trigger": "active",
    "retired": true,
    "details": []
  },
  {
    "id": "choiceRoll",
    "name": "최후의 선택",
    "description": "주사위 하나를 다시 굴린 뒤, 이전 눈과 새 눈 중 좋은 쪽을 골라요. 일반 굴림 횟수는 줄지 않아요. 매 턴 1회.",
    "charges": -1,
    "tags": [
      "roll"
    ],
    "rarity": "gold",
    "trigger": "active",
    "details": []
  },
  {
    "id": "fakeHouse",
    "name": "강제 룸메이트",
    "description": "주사위 둘의 눈을 합은 그대로, 최대한 같게 나눠요. 1·5→3·3, 2·5→3·4! 턴당 1회·게임당 3회. 덤으로 4+1도 풀하우스 25점 인정.",
    "charges": 3,
    "tags": [
      "kind"
    ],
    "rarity": "gold",
    "trigger": "active",
    "details": [
      "조작 횟수를 모두 써도 4+1 풀하우스 인정 효과는 유지됩니다."
    ]
  },
  {
    "id": "artisan",
    "name": "스트레이트 밀수업자",
    "description": "중복된 주사위 하나를 지금 없는 숫자로 바꿔요. 1·2·2·4·5에서 2→3! 턴당 1회·게임당 3회. 서로 다른 눈 5종 이상으로 기록하면 어느 칸이든 +5점.",
    "charges": 3,
    "tags": [
      "straight"
    ],
    "rarity": "gold",
    "trigger": "active",
    "details": [
      "조작 횟수를 모두 써도 서로 다른 눈 5종의 별도 +5점은 유지됩니다."
    ]
  },
  {
    "id": "hunter",
    "name": "사냥꾼",
    "description": "어느 칸에 기록하든 같은 눈 3개면 +4, 4개면 +8, 5개 이상이면 +12점! 가장 높은 보너스 하나만 지급, 게임 전체 최대 36점.",
    "charges": 0,
    "tags": [
      "kind"
    ],
    "rarity": "gold",
    "trigger": "passive",
    "details": []
  },
  {
    "id": "chance",
    "name": "이번 판은 현금으로",
    "description": "족보를 포기하고 환전! 이번 주사위 합+10점을 빈 하단 칸에 쓸 수 있어요. 최대 40점, 배율·족보 가산점 제외. 이후 재굴림 종료. 게임당 1회.",
    "charges": 1,
    "tags": [
      "sum"
    ],
    "rarity": "gold",
    "trigger": "active",
    "details": []
  },
  {
    "id": "target",
    "name": "목표 명중",
    "description": "첫 굴림 전에 빈 점수칸을 지정하세요. 그 칸에 1점 이상 기록하면 +12점, 다른 칸이나 0점을 기록하면 -6점. 게임당 3회.",
    "charges": 3,
    "tags": [
      "gamble"
    ],
    "rarity": "gold",
    "trigger": "active",
    "retired": true,
    "details": []
  },
  {
    "id": "loan",
    "name": "여기서 두 배를 태워?",
    "description": "첫 굴림 전에 선언! 기본 족보 25점 이상이면 +20점, 미만이면 -10점. 두 번째 일반 굴림 뒤 두 배 걸고 한 번 더 던지면 +40/-20! 게임당 1회.",
    "charges": 1,
    "tags": [
      "gamble"
    ],
    "rarity": "gold",
    "trigger": "active",
    "details": []
  },
  {
    "id": "revive",
    "name": "패자 부활전",
    "description": "첫 굴림 전에 주사위 2개를 원하는 같은 눈으로 보관해요. 처음 1회 지급, 0점 기록 시 사용권 회복! 보유 최대 1회, 게임당 최대 3회 사용.",
    "charges": 1,
    "tags": [
      "zero"
    ],
    "rarity": "gold",
    "trigger": "active",
    "details": []
  },
  {
    "id": "parasite",
    "name": "너 내 스폰서 해라",
    "description": "첫 굴림 전에 상대 한 명과 계약! 상대가 기본 족보 20점 이상 기록하면 나는 +5점. 내가 상대의 직전 기본 점수(최소 10점)를 넘거나 같아도 +5점! 합계 최대 40점, 계약은 게임 끝까지.",
    "charges": 1,
    "tags": [
      "rival"
    ],
    "rarity": "gold",
    "trigger": "active",
    "details": []
  },
  {
    "id": "thief",
    "name": "수금하러 왔습니다",
    "description": "상대는 다음 턴에 8점을 내거나, 그 턴 기본 족보 점수의 40%를 내게 줘요(올림, 최대 18점). 기본 0점이면 수금도 0점. 방패로 방어, 게임당 2회.",
    "charges": 2,
    "tags": [
      "attack"
    ],
    "rarity": "gold",
    "trigger": "active",
    "details": []
  },
  {
    "id": "lock",
    "name": "이거 들고 가세요",
    "description": "내 주사위 중 1~3 하나를 상대에게 보내요. 상대의 다음 첫 굴림에서 주사위 하나가 그 눈으로 변하고 턴 내내 변경·재굴림 불가! 내 주사위는 그대로, 방패로 방어, 게임당 2회.",
    "charges": 2,
    "tags": [
      "attack"
    ],
    "rarity": "gold",
    "trigger": "active",
    "details": []
  },
  {
    "id": "seal",
    "name": "굴림 봉인",
    "description": "상대의 다음 턴 일반 굴림을 1회 줄여요(최소 1회). 방패에 막히지 않고 예약하면 나는 즉시 +5점! 게임당 2회.",
    "charges": 2,
    "tags": [
      "attack"
    ],
    "rarity": "gold",
    "trigger": "active",
    "details": []
  },
  {
    "id": "reflect",
    "name": "반사 방패",
    "description": "매 라운드 나에게 처음 들어오는 방해를 막고, 공격한 사람에게 -5점. 이 반격은 다시 반사되지 않아요.",
    "charges": 0,
    "tags": [
      "defense"
    ],
    "rarity": "gold",
    "trigger": "passive",
    "details": []
  },
  {
    "id": "loser",
    "name": "추격자",
    "description": "선택 즉시 +8점! 내 턴 시작에 선두보다 20점 이상 뒤처졌으면 그 턴 일반 굴림 +2회. 추가 굴림은 게임당 최대 3턴.",
    "charges": 0,
    "tags": [
      "comeback"
    ],
    "rarity": "gold",
    "trigger": "passive",
    "details": []
  },
  {
    "id": "sixth",
    "name": "여섯 번째 주사위",
    "description": "매 턴 주사위를 1개 더 굴려요. 버리는 주사위 없이 전부 점수 계산에 써요.",
    "charges": 0,
    "tags": [
      "roll"
    ],
    "rarity": "prism",
    "trigger": "passive",
    "details": []
  },
  {
    "id": "wild",
    "name": "무지개 와일드",
    "description": "굴린 주사위 하나를 원하는 숫자(1~6)로 바꿔요. 사용 후에는 더 굴리거나 눈을 바꿀 수 없어요. 매 턴 1회.",
    "charges": -1,
    "tags": [
      "change"
    ],
    "rarity": "prism",
    "trigger": "active",
    "retired": true,
    "details": []
  },
  {
    "id": "defect",
    "name": "불량품 백화점",
    "description": "아깝게 실패한 하단 족보도 낮은 점수로 인정해요. 포커·풀하우스·스트레이트·요트의 완화 조건은 아래 표에서 확인하세요.",
    "charges": 0,
    "tags": [
      "kind"
    ],
    "rarity": "prism",
    "trigger": "passive",
    "details": [
      "포커: 같은 숫자 3개 → 전체 합의 80%(소수점 버림).",
      "풀하우스: 같은 숫자 3개와 다른 숫자, 또는 서로 다른 두 쌍 → 전체 합의 80%.",
      "스몰: 연속 숫자 3종 → 12점. 라지: 연속 숫자 4종 → 24점. 요트: 같은 숫자 4개 → 40점.",
      "정상 족보가 완성되면 정상 점수를 씁니다. 추가 주사위도 전부 계산합니다."
    ]
  },
  {
    "id": "cat",
    "name": "상자 속 고양이",
    "description": "일반 굴림을 다 쓴 뒤, 지금 결과를 저장하고 새로 최대 3번 던져요. 원래 결과와 새 결과 중 선택! 강제 고정은 유지하며 재도전 중 다른 능력은 못 써요. 게임당 1회.",
    "charges": 1,
    "tags": [
      "roll"
    ],
    "rarity": "prism",
    "trigger": "active",
    "details": [
      "재도전은 일반 굴림이 끝난 뒤 최대 3번입니다. 중간에 새 결과를 선택하고 기록해도 됩니다.",
      "봉인·강제 고정은 그대로입니다. 재도전 중 다른 사용형 증강은 잠기며, 이미 처리한 공격과 지급은 반복하지 않습니다."
    ]
  },
  {
    "id": "erase",
    "name": "최저점 보장",
    "description": "족보에 20점 미만을 쓰면 부족한 만큼 별도 보너스로 채워요. 예: 기록 7점(+보너스 13점). 게임 전체 최대 45점, 상단 63점에는 포함하지 않아요.",
    "charges": 0,
    "tags": [
      "zero"
    ],
    "rarity": "prism",
    "trigger": "passive",
    "details": []
  },
  {
    "id": "parallel",
    "name": "한 턴에 두 탕",
    "description": "이번 기록과 다른 족보를 골라 별도 보너스를 최대 40점 받아요. 이미 쓴 칸도 가능하며 그 칸은 바뀌지 않아요. 기본 족보만 계산, 게임당 2회·턴당 1회.",
    "charges": 2,
    "tags": [
      "lower"
    ],
    "rarity": "prism",
    "trigger": "active",
    "details": [
      "사용: 주사위가 멈춘 뒤 다른 족보를 선택 → 점수판에서 이번에 기록할 빈 칸을 선택.",
      "예: 6·6·6·6·6에서 요트를 고르고 식스에 기록하면 식스 30점(+보너스 40점). 요트 칸은 그대로입니다.",
      "기본 족보만 별도로 계산합니다. 사냥꾼·악마의 계약·불량품도 야추다 등은 이 보너스에 다시 적용하지 않습니다."
    ]
  },
  {
    "id": "devil",
    "name": "악마의 계약",
    "description": "첫 굴림 전에 계약! 기본 족보 20점 이상이면 같은 점수를 기록에 추가해요(추가 최대 30점). 미만이면 그 칸은 0점! 별도 보너스는 판정에서 제외, 게임당 2회·턴당 1회.",
    "charges": 2,
    "tags": [
      "gamble"
    ],
    "rarity": "prism",
    "trigger": "active",
    "details": [
      "기본 24점 → 기록 48점. 기본 50점 → 기록 80점. 기본 19점 → 기록 0점.",
      "상단 63점 달성 여부는 원래 주사위로 계산한 상단 기본 점수만 사용합니다."
    ]
  },
  {
    "id": "substitute",
    "name": "족보 대체권",
    "description": "족보가 안 맞아도 빈칸 하나에 주사위 합을 쓸 수 있어요. 최대 25점. 예: 요트 실패여도 합이 23이면 요트 칸에 23점. 매 턴 1회.",
    "charges": -1,
    "tags": [
      "safe"
    ],
    "rarity": "prism",
    "trigger": "active",
    "retired": true,
    "details": []
  },
  {
    "id": "worldFlip",
    "name": "세상을 뒤집는 자",
    "description": "뒤집을 주사위를 한 번에 골라요. 1↔6, 2↔5, 3↔4로 바뀌어요. 이후 재굴림은 끝나지만 다른 눈 변경 능력은 쓸 수 있어요. 매 턴 1회.",
    "charges": -1,
    "tags": [
      "change"
    ],
    "rarity": "prism",
    "trigger": "active",
    "retired": true,
    "details": []
  },
  {
    "id": "swap",
    "name": "왕의 압수수색",
    "description": "획득 즉시 내 골드 1개와 상대 골드 1개를 영구 교환해요. 다 쓴 능력은 못 바꿔요. 교환할 대상이 없으면 대신 +10점.",
    "charges": 1,
    "tags": [
      "attack"
    ],
    "rarity": "prism",
    "trigger": "active",
    "retired": true,
    "details": []
  },
  {
    "id": "duel",
    "name": "콜? 쫄?",
    "description": "상대에게 결투 신청! 거절하면 상대에게 15점을 받고 별도 보너스 10점도 받아요. 수락하면 서로 다음 턴 최대 2회 굴려 기본 족보 점수 대결: 승자 +40, 패자 -10, 동점 각각 +15. 게임당 1회.",
    "charges": 1,
    "tags": [
      "attack"
    ],
    "rarity": "prism",
    "trigger": "active",
    "details": []
  },
  {
    "id": "doppel",
    "name": "도플갱어",
    "description": "획득 즉시 상대의 횟수 제한 없는 골드 능력 1개를 복사해요. 상대 능력도 남아요. 복사할 대상이 없으면 대신 +10점.",
    "charges": 1,
    "tags": [
      "rival"
    ],
    "rarity": "prism",
    "trigger": "active",
    "retired": true,
    "details": []
  },
  {
    "id": "evolution",
    "name": "현실 조작",
    "rarity": "gold",
    "description": "손끝 보정을 이 능력으로 교체해요. 주사위 하나를 최대 2 올리거나 내려요. 예: 4 → 2·3·5·6. 1~6 안에서, 턴당 1회·새로 4회 사용 가능.",
    "trigger": "active",
    "charges": 4,
    "tags": [
      "change"
    ],
    "details": []
  },
  {
    "id": "taxSix",
    "name": "6 나왔죠? 세금입니다",
    "rarity": "silver",
    "description": "상대의 다음 최종 주사위에서 6 하나당 3점씩 뺏어요. 최대 9점, 상대가 이번 턴 얻은 점수까지만! 방패로 방어, 게임당 2회.",
    "charges": 2,
    "trigger": "active",
    "tags": [
      "attack"
    ],
    "flash": true,
    "details": []
  },
  {
    "id": "dropIt",
    "name": "바나나 껍질",
    "rarity": "silver",
    "description": "상대의 다음 첫 굴림에서 가장 높은 주사위 하나가 미끄러져 1로 바뀌어요. 같은 눈이면 무작위 하나! 이후 다시 굴릴 수 있어요. 게임당 2회.",
    "charges": 2,
    "trigger": "active",
    "tags": [
      "attack"
    ],
    "flash": true,
    "details": []
  },
  {
    "id": "receipt",
    "name": "그거 굴리면 터진다",
    "rarity": "silver",
    "description": "상대의 다음 첫 굴림에 폭탄 하나! 그 주사위를 다시 굴리면 나는 +8점, 끝까지 안 굴리고 기록하면 상대 -8점. 한 폭탄은 한 번만 터져요. 방패로 방어, 게임당 2회.",
    "charges": 2,
    "trigger": "active",
    "tags": [
      "gamble"
    ],
    "flash": true,
    "details": []
  },
  {
    "id": "broken",
    "name": "그 버튼 이제 제 겁니다",
    "rarity": "gold",
    "description": "상대의 사용형 골드 하나를 다음 턴 동안 막고 내가 한 번 빌려 써요. 빌린 능력은 내 다음 턴 끝에 사라져요. 상대의 사용 횟수는 그대로! 게임당 2회.",
    "charges": 2,
    "trigger": "active",
    "tags": [
      "attack"
    ],
    "flash": true,
    "details": []
  },
  {
    "id": "construction",
    "name": "메뉴판이 살아 있다",
    "rarity": "gold",
    "description": "상대는 다음 턴에 무작위 빈칸 2개만 기록할 수 있어요. 일반 굴림마다 메뉴 재추첨! 무료 재굴림은 유지. 빈칸 3개 이상인 상대에게 게임당 2회.",
    "charges": 2,
    "trigger": "active",
    "tags": [
      "attack"
    ],
    "flash": true,
    "details": []
  },
  {
    "id": "handsUp",
    "name": "너희만 믹서기 입장",
    "rarity": "gold",
    "description": "나 빼고 상대들만! 다음 두 번째 일반 굴림에 보관한 주사위도 전부 컵으로! 강제 보관 제외. 한 명이라도 방해 예약에 성공하면 나는 즉시 +10점. 첫 굴림 기록으로 회피 가능. 게임당 1회.",
    "charges": 1,
    "trigger": "active",
    "tags": [
      "attack"
    ],
    "flash": true,
    "details": []
  },
  {
    "id": "closed",
    "name": "성적표 맞바꿔치기",
    "rarity": "prism",
    "description": "나와 상대가 이미 쓴 같은 하단 점수칸 하나를 통째로 맞바꿔요. 예: 내 요트 0점 ↔ 상대 50점! 상대는 게임 중 한 번만 당해요. 게임당 1회.",
    "charges": 1,
    "trigger": "active",
    "tags": [
      "attack"
    ],
    "flash": true,
    "details": [
      "2·3·4인전 모두 사용 가능합니다. 방패로 방어할 수 있습니다.",
      "한 번 교환당한 상대는 이 카드와 점수표 회전목마의 대상에서 함께 제외됩니다."
    ]
  },
  {
    "id": "strike",
    "name": "점수표 회전목마",
    "rarity": "prism",
    "description": "기록한 하단 한 칸을 3명 이상이 서로 회전해요. 내게 높은 점수가 오는 방향! 방패·이미 교환당한 사람 제외 후 3명 미만이면 사용 불가. 게임당 1회, 교환당한 상대는 맞바꿔치기도 다시 당하지 않아요.",
    "charges": 1,
    "trigger": "active",
    "tags": [
      "attack"
    ],
    "flash": true,
    "details": []
  },
  {
    "id": "squid",
    "name": "판돈은 목숨입니다",
    "rarity": "prism",
    "description": "참가자 전원 20점 납부! 다음 턴 상대는 최대 2번, 나는 최대 3번 굴려요. 기본 족보 최고점이 판돈 전액+60점 독식! 동점은 분할. 나 포함 2명 이상·소지 20점 필요. 방패로 거절, 기권 시 환급. 게임당 1회.",
    "charges": 1,
    "trigger": "active",
    "tags": [
      "gamble"
    ],
    "flash": true,
    "details": []
  },
  {
    "id": "parkingTicket",
    "name": "거기 주차 금지",
    "rarity": "silver",
    "trigger": "active",
    "charges": 2,
    "tags": [
      "attack"
    ],
    "description": "상대의 다음 턴에 3개 이상 보관한 적이 있으면 기록할 때 -8점! 예약 성공 시 나는 +3점. 방패로 막으면 둘 다 없음, 게임당 2회.",
    "details": []
  },
  {
    "id": "butterFingers",
    "name": "손에 버터 발랐냐",
    "rarity": "gold",
    "trigger": "active",
    "charges": 1,
    "tags": [
      "attack"
    ],
    "description": "상대는 다음 턴에 주사위를 1개까지만 보관할 수 있어요. 나머지는 다시 굴릴 때 전부 컵으로! 게임당 1회.",
    "details": []
  },
  {
    "id": "ordinaryDay",
    "name": "통행료 선불제",
    "rarity": "prism",
    "trigger": "active",
    "charges": 1,
    "tags": [
      "attack"
    ],
    "description": "상대를 골라 즉시 최대 15점을 뺏어요. 상대의 다음 턴에 골드·프리즘이 실제 작동하면 종류마다 5점씩 더! 자동 효과 포함, 총 강탈 최대 25점. 방패로 방어, 게임당 1회.",
    "details": [
      "예: 즉시 15점 강탈 → 상대가 연금술을 쓰면 5점 → 다시 연금술은 0점 → 다른 골드가 작동하면 5점. 합계 최대 25점.",
      "추가 주사위는 실제 굴렸을 때, 추가 굴림은 네 번째 굴림을 사용했을 때, 점수 보너스는 실제 지급됐을 때 통행료를 냅니다.",
      "피해자가 가진 점수까지만 이동합니다. 통행료 자체나 반격 피해가 다시 통행료를 만들지 않습니다."
    ]
  },
  {
    "id": "tomorrow",
    "name": "흑역사 세탁",
    "rarity": "silver",
    "trigger": "active",
    "charges": 2,
    "tags": [
      "hold"
    ],
    "description": "1~3인 주사위 하나를 찍으면 다음 내 첫 굴림에 반대 눈(6~4)을 보관하고 시작해요. 이번 주사위는 그대로, 계속 굴려도 돼요. 턴당 1회·게임당 2회.",
    "details": []
  },
  {
    "id": "bounty",
    "name": "숫자 공개수배",
    "rarity": "silver",
    "charges": 2,
    "trigger": "active",
    "tags": [
      "attack"
    ],
    "description": "상대와 수배할 숫자를 고르세요. 상대의 다음 최종 결과에 2개 이상 있으면 나는 +8점! 피하면 상대가 +3점. 공격이 아니므로 방패를 쓰지 않아요. 게임당 2회.",
    "details": []
  },
  {
    "id": "taste",
    "name": "남의 떡 한입만",
    "rarity": "gold",
    "charges": 3,
    "trigger": "active",
    "tags": [
      "change"
    ],
    "description": "상대의 지난 최종 결과에 있던 숫자를 내 주사위 하나에 복사해요. 굴림이 멈췄을 때 턴당 1회·게임당 3회.",
    "retired": true,
    "details": []
  },
  {
    "id": "inspection",
    "name": "보관함 털이",
    "rarity": "gold",
    "charges": 2,
    "trigger": "active",
    "tags": [
      "attack"
    ],
    "description": "상대의 다음 두 번째 일반 굴림에 보관한 주사위 최대 2개도 컵에 넣어요. 강제 보관은 제외! 첫 굴림만으로 기록하면 피해요. 게임당 2회.",
    "retired": true,
    "details": []
  },
  {
    "id": "memory",
    "name": "명장면 재방송",
    "rarity": "prism",
    "charges": 2,
    "trigger": "active",
    "tags": [
      "hold"
    ],
    "description": "첫 굴림 대신 과거 최종 주사위 기록을 불러와요. 현재 주사위 수만큼 복사하고 부족한 것은 던져요. 강제 고정·봉인은 유지, 첫 굴림 1회로 계산. 게임당 2회.",
    "details": []
  },
  {
    "id": "fork",
    "name": "평행 던지기",
    "rarity": "prism",
    "charges": 2,
    "trigger": "active",
    "tags": [
      "roll"
    ],
    "description": "다음 일반 굴림을 두 번 던져 A 또는 B 결과 전체를 골라요. 횟수는 1회만 차감! 첫 굴림에 걸린 방해는 먼저 해결해야 해요. 턴당 1회·게임당 2회.",
    "retired": true,
    "details": []
  },
  {
    "id": "dinner",
    "name": "오늘 회식은 1차만",
    "rarity": "silver",
    "charges": 1,
    "trigger": "active",
    "tags": [
      "gamble"
    ],
    "flash": true,
    "description": "나는 즉시 +8점! 참가자 모두 다음 자기 턴에 1이 있으면 +5점, 하나도 없으면 -5점. 1이 3개 이상이면 대신 +10점! 방패로 불참 가능, 게임당 1회.",
    "details": []
  },
  {
    "id": "bombParcel",
    "name": "착불 폭탄입니다",
    "rarity": "gold",
    "charges": 1,
    "trigger": "active",
    "tags": [
      "attack"
    ],
    "flash": true,
    "description": "상대는 다음 턴 내게 15점을 내거나 폭탄을 열어요. 1~4면 상대가 내게 25점, 5~6이면 역폭발! 내가 상대에게 10점. 가진 점수까지만 이동, 피해 상한 25점 예외. 게임당 1회.",
    "details": []
  },
  {
    "id": "hostage",
    "name": "악마의 택배",
    "rarity": "prism",
    "charges": 1,
    "trigger": "active",
    "tags": [
      "attack"
    ],
    "flash": true,
    "description": "상대는 다음 첫 굴림 뒤 내게 몸값 30점을 주거나, 주사위 세 개를 1로 봉인! 봉인된 셋은 그 턴 재굴림·눈 변경 불가. 몸값은 피해 상한 30점 예외, 방패로 방어 가능. 게임당 1회.",
    "details": []
  },
  {
    "id": "confiscate",
    "name": "전부 압수입니다",
    "rarity": "prism",
    "trigger": "active",
    "charges": 1,
    "tags": [
      "attack"
    ],
    "flash": true,
    "description": "상대마다 다음 턴 주사위 1개를 뺏어 내 다음 턴에 굴려요! 2인전은 실제 압수 성공 시 보너스 주사위도 1개 추가(나는 +2, 상대 -1). 방패로 막힌 건 제외, 게임당 1회.",
    "details": []
  },
  {
    "id": "practice",
    "name": "방금 건 연습",
    "rarity": "silver",
    "charges": 2,
    "trigger": "active",
    "flash": true,
    "tags": [
      "attack"
    ],
    "description": "상대가 두 번째 일반 굴림을 마치면 가장 높은 주사위 하나를 강제로 다시 던져요. 강제 고정 제외, 새 결과 필수! 완료하면 나는 +6점, 첫 굴림만 기록해 피하면 +3점. 게임당 2회.",
    "details": []
  },
  {
    "id": "misdelivery",
    "name": "택배 오배송",
    "rarity": "gold",
    "charges": 2,
    "trigger": "active",
    "flash": true,
    "tags": [
      "attack",
      "change"
    ],
    "description": "내 주사위 하나를 상대의 지난 결과에 있던 눈으로 바꿔요. 상대에게는 내 원래 눈을 보내 다음 턴 끝까지 강제 보관! 눈 변경도 불가. 게임당 2회.",
    "details": []
  },
  {
    "id": "goldRush",
    "name": "골드 대이동",
    "rarity": "prism",
    "charges": 1,
    "trigger": "active",
    "flash": true,
    "tags": [
      "attack"
    ],
    "description": "각자의 사용 가능한 골드 하나를 무작위로 골라 옆 사람에게 넘겨요. 나는 받은 카드 완충과 +20점! 사용형이면 이번 턴 1회 제한을 한 번 더 넘길 수 있고, 자동형이면 추가 +10점. 방패 제외, 게임당 1회.",
    "details": [
      "사용 횟수는 카드와 함께 이동합니다. 시전자가 받은 카드만 원래 횟수로 충전됩니다.",
      "추가 사용은 이번 턴의 턴당 1회 제한만 한 번 해제합니다. 충전된 횟수는 정상 차감하며 첫 굴림 전·대상·다음 턴 조건은 그대로입니다."
    ]
  },
  {
    "id": "customDie",
    "name": "눈금 공장",
    "rarity": "prism",
    "trigger": "active",
    "charges": -1,
    "tags": [
      "change"
    ],
    "description": "매 턴 첫 굴림 전에 숫자 하나를 다른 숫자로 바꿔 인쇄해요. 이번 턴 내 모든 6면체에 적용! 예: 1→6이면 6이 두 면. 12면체 제외, 다음 턴 초기화.",
    "details": [
      "물리 주사위의 한 면에 다른 숫자를 인쇄합니다. 굴린 뒤 결과를 바꾸는 기능이 아닙니다.",
      "1→6: 모든 6면체가 [6,2,3,4,5,6]이 됩니다. 내 턴마다 다른 숫자를 고를 수 있습니다."
    ]
  },
  {
    "id": "monster",
    "name": "야추가 주사위를 먹었다",
    "rarity": "prism",
    "flash": true,
    "trigger": "active",
    "charges": 2,
    "tags": [
      "roll",
      "change"
    ],
    "description": "첫 굴림 전 주사위 둘을 실제 12면체 하나로 합쳐요. 굴린 눈을 합이 같은 1~6 두 개로 나눈 뒤 기록! 1이면 1+1과 -8점. 다른 6면체 능력은 가능, 괴물 직접 변경·세계 되돌리기는 불가. 게임당 2회.",
    "details": []
  },
  {
    "id": "custody",
    "name": "공동 육아 전쟁",
    "rarity": "gold",
    "flash": true,
    "trigger": "active",
    "charges": 1,
    "tags": [
      "attack"
    ],
    "description": "상대와 각자 2턴 동안 공동 주사위의 마지막 눈을 넘겨요. 기록하는 사람의 공동 눈이 4~6이면 본인 +6, 1~3이면 연결된 상대 +6! 한 사람 최대 18점. 다음 첫 굴림에는 보관, 이후 재굴림 가능. 추가 주사위 아님, 게임당 1회.",
    "details": [
      "화면에서 표시된 공동 주사위 하나를 사용합니다. 주사위 수는 늘지 않습니다.",
      "기록하는 사람 기준으로 공동 눈이 4~6이면 본인이 +6점, 1~3이면 연결된 상대가 +6점입니다.",
      "전달받은 눈은 첫 굴림 동안 보관됩니다. 두 번째 굴림부터 다시 던질 수 있습니다."
    ]
  },
  {
    "id": "estate",
    "name": "여기부터 제 땅입니다",
    "rarity": "gold",
    "trigger": "active",
    "charges": 1,
    "tags": [
      "score"
    ],
    "description": "빈 칸 3곳을 계약해요. 2곳에 1점 이상 기록하면 +8점, 3곳 완공 시 추가 +24점! 0점으로 실패한 부지는 첫 굴림 전에 다른 빈 칸으로 한 번 옮길 수 있어요.",
    "details": [
      "두 곳 성공 시 누적 +8점, 세 곳 성공 시 누적 +32점입니다.",
      "0점인 실패 부지 하나만 다른 빈 칸으로 옮깁니다. 이미 완공한 부지는 바꿀 수 없습니다."
    ]
  },
  {
    "id": "crown",
    "name": "마지막에 웃는 놈이 임자",
    "rarity": "prism",
    "flash": true,
    "trigger": "active",
    "charges": 1,
    "tags": [
      "score"
    ],
    "description": "즉시 +10점! 각자 2턴 동안 기본 족보 25점 이상으로 왕관을 뺏어요. 이후에는 현재 기준보다 높아야 탈취! 끝까지 가진 사람 +40점. 다른 미사용 왕관 카드는 즉시 +35점으로 교환. 게임당 1회.",
    "details": []
  },
  {
    "id": "cashNow",
    "name": "일시불로 주세요",
    "rarity": "silver",
    "trigger": "passive",
    "charges": 1,
    "tags": [
      "score"
    ],
    "description": "선택하는 즉시 증강 보너스 +20점! 딱 한 번 받고 끝이에요. 점수칸은 쓰지 않으며 상단 63점 보너스에는 포함되지 않아요.",
    "details": []
  },
  {
    "id": "rollVault",
    "name": "몰빵 주사위통",
    "rarity": "prism",
    "trigger": "passive",
    "charges": 0,
    "tags": [
      "roll"
    ],
    "description": "남은 내 턴 수×3+6회의 일반 굴림을 받아 나눠 써요. 한 턴 최대 7회, 이후 턴당 1회는 남겨야 해요. 마지막 턴 후 남은 굴림은 1회당 보너스 2점, 최대 12점.",
    "details": [
      "10라운드에 남은 3턴이라면 총 15회입니다. 이번 턴에 최대 7회를 쓸 수 있습니다.",
      "추가 굴림 증강·사건은 잔고에도 반영됩니다. 무료 재굴림과 고양이 재도전은 잔고를 쓰지 않습니다."
    ]
  },
  {
    "id": "scoreRemodel",
    "name": "점수판 이사가는 날",
    "rarity": "prism",
    "trigger": "active",
    "charges": 1,
    "tags": [
      "score"
    ],
    "description": "첫 굴림 전에 기록한 하단 칸을 다시 열고 다른 빈 하단 칸에 0점을 써요. 지운 점수는 보너스로 보존하고 추가로 15점! 총점은 15점 증가, 게임당 1회.",
    "details": []
  }
];
export const FLASH_AUGMENTS = AUGMENTS.filter(d=>d.flash);
export const NEW_AUGMENTS = AUGMENTS.filter(d=>["bounty", "taste", "inspection", "memory", "fork", "dinner", "bombParcel", "hostage"].includes(d.id));
export const MISCHIEF_IDS = [
  "parkingTicket",
  "butterFingers",
  "ordinaryDay",
  "bounty",
  "inspection",
];
export const EVENTS = [
  {
    id: "reverse",
    name: "거꾸로 세계",
    description:
      "이번 턴에 한 번, 주사위 하나를 뒤집을 수 있어요. 1↔6, 2↔5, 3↔4. 사용 후 재굴림은 끝나요.",
  },
  {
    id: "speed",
    name: "속전속결",
    description:
      "이번 라운드는 모두 일반 굴림이 1회 줄어요. 대신 족보에 1점 이상 기록하면 보너스 +10점.",
  },
  {
    id: "overflow",
    name: "주사위 과잉 공급",
    description:
      "이번 라운드는 모두 주사위를 1개 더 굴려요. 버리지 않고 나온 주사위 전부로 점수를 계산해요.",
  },
  {
    id: "aid",
    name: "정부 지원금",
    description:
      "이번 기본 족보 점수가 0점이면 보너스 +12점, 1~15점이면 +6점. 16점 이상은 지원금이 없어요.",
  },
  {
    id: "bomb",
    name: "폭탄 돌리기",
    description:
      "첫 굴림 전에 도전할지 골라요. 마지막 주사위에 6이 3개 이상이면 +20점, 아니면 -8점. 도전하지 않아도 돼요.",
  },
  {
    id: "chaos",
    name: "혼돈의 선택",
    description:
      "한 번만 주사위 하나를 무료로 다시 굴릴 수 있어요. 새 결과를 반드시 쓰고, 그 뒤에는 더 굴릴 수 없어요.",
  },
  {
    id: "debt",
    name: "빚내서 굴려",
    description:
      "첫 굴림 전에 선택하세요. 이번 턴 점수에서 8점을 내는 대신 일반 굴림이 1회 늘어나요. 선택하지 않아도 돼요.",
  },
  {
    id: "exchange",
    name: "숫자 교환소",
    description:
      "두 번째 일반 굴림 이후, 주사위 하나를 무료로 다시 굴리면 보너스 +8점. 새 결과를 반드시 써야 해요. 이번 턴 1회.",
  },
] as const;
export const augmentCommandSchema = z.strictObject({
  op: z.enum(["pick", "refresh", "use", "keepOld", "world", "resolve"]),
  id: z.string().max(40).optional(),
  offerIndex: z.number().int().min(0).max(3).optional(),
  die: z.number().int().min(0).max(9).optional(),
  historyIndex: z.number().int().min(0).max(11).optional(),
  faces: z.array(z.number().int().min(1).max(6)).length(6).optional(),
  categories: z.array(z.string().max(30)).length(3).optional(),
  value: z.number().int().min(0).max(9).optional(),
  target: z.string().max(40).optional(),
  other: z.string().max(40).optional(),
  category: z.string().max(30).optional(),
  destination: z.string().max(30).optional(),
  indices: z.array(z.number().int().min(0).max(9)).max(10).optional(),
  seals: z
    .array(
      z.object({ target: z.string().max(40), category: z.string().max(30) }),
    )
    .max(2)
    .optional(),
});
export type AugmentCommand = z.infer<typeof augmentCommandSchema>;
const instance = z.object({
  id: z.string(),
  remaining: z.number().int(),
  usedTurn: z.number().int().default(-1),
  usedRound: z.number().int().default(-1),
  borrowedAt: z.number().int().optional(),
  uses: z.number().int().min(0).optional(),
  target: z.string().optional(),
  earned: z.number().min(0).optional(),
  extraTurn: z.number().int().optional(),
});
export const augmentPlayerSchema = z.object({
  items: z.array(instance),
  offers: z.array(z.string()).max(4),
  rerolled: z.array(z.boolean()).min(3).max(4).default([false, false, false]),
  seenOffers: z.array(z.string()).max(8).default([]),
  flashOffer: z.boolean().default(false),
  bonus: z.number(),
  rawUpper: z.number(),
  streak: z.number(),
  savingsPaid: z.boolean(),
  progress: z.record(z.string(), z.number()).optional(),
  rollBank: z.number().optional(),
  customFaces: z.array(z.number().int().min(1).max(6)).length(6).optional(),
  estate: z.object({plots:z.array(z.string()).length(3),paid:z.number(),completed:z.array(z.string()).default([]),ruined:z.array(z.string()).default([]),relocated:z.boolean().optional()}).optional(),
  bounties: z.array(z.object({from:z.string(),face:z.number().int().min(1).max(6)})).max(4).optional(),
  previousZero: z.boolean(),
  savedFace: z.number().int().min(1).max(6).nullable().optional(),
  lastDice: z.array(z.number().int().min(1).max(6)).optional(),
  archive: z
    .array(
      z.object({
        category: z.string(),
        dice: z.array(z.number().int().min(1).max(6)).max(10),
      }),
    )
    .max(12)
    .default([]),
  scoreSwapped: z.boolean().default(false),
  roundIncome: z.record(z.string(), z.number()),
  curse: z
    .object({
      id: z.string(),
      from: z.string(),
      active: z.boolean().optional(),
      die: z.number().int().min(0).max(9).optional(),
      resolved: z.boolean().optional(),
      other: z.string().optional(),
      values: z.array(z.number().int().min(1).max(6)).max(3).optional(),
      categories: z.array(z.string()).optional(),
      paid: z.number().optional(),
      triggered: z.array(z.string()).optional(),
    })
    .nullable(),
});
const snapshot = z.object({
  dice: z.array(z.number().nullable()),
  held: z.array(z.boolean()),
  rolls: z.number(),
  kept: z.array(z.number()).optional(),
  poses: z
    .array(
      z.object({
        p: z.tuple([z.number(), z.number(), z.number()]),
        q: z.tuple([z.number(), z.number(), z.number(), z.number()]),
      }),
    )
    .optional(),
  customOverride: z.record(z.string(),z.array(z.number())).optional(),
});
export const augmentPresentationSchema=z.object({
  stage:z.enum(['acquire','use','resolve','score','roll']),
  level:z.enum(['small','emphasis','major']),
  actorId:z.string(),abilityId:z.string().optional(),targetIds:z.array(z.string()).max(4),
  players:z.array(z.object({id:z.string(),name:z.string(),before:z.number(),after:z.number(),beforeRank:z.number(),afterRank:z.number()})).max(4),
  cells:z.array(z.object({playerId:z.string(),category:z.string(),before:z.number().nullable(),after:z.number().nullable()})).max(48),
  dice:z.array(z.object({index:z.number(),before:z.number().nullable(),after:z.number().nullable()})).max(10),
  cards:z.array(z.object({from:z.string(),to:z.string(),id:z.string(),before:z.number(),after:z.number()})).max(16),
  defenses:z.array(z.object({defenderId:z.string(),reflected:z.boolean()})).max(4),
  rerollIndices:z.array(z.number()).max(10),
  outcome:z.enum(['jackpot','backfire','counter','steal','comeback']).optional(),
});
export type AugmentPresentation=z.infer<typeof augmentPresentationSchema>;
export const augmentStateSchema = z.object({
  resultSerial:z.number().int().nonnegative().optional(),
  round: z.number().int(),
  drafting: z.boolean(),
  order: z.array(z.string()),
  done: z.array(z.string()),
  first: z.number().int(),
  event: z.string().nullable(),
  log: z.array(z.string()),
  results: z.array(z.object({ key: z.string(), text: z.string(), presentation:augmentPresentationSchema.optional(), payouts: z.array(z.object({playerId:z.string(),amount:z.number(),reason:z.string()})).optional(), activation: z.object({
    id: z.string(), actor: z.string(), targets: z.array(z.string()), name: z.string(), effect: z.string(),
    kind: z.enum(["attack", "defense", "dice", "swap", "gamble", "score"]),
    rarity: z.enum(["silver", "gold", "prism"]), flash: z.boolean(),
  }).optional() })).default([]),
  turn: z.object({
    customOverride:z.record(z.string(),z.array(z.number().int().min(1).max(6)).length(6)).optional(),
    monster:z.object({index:z.number().int(),split:z.boolean()}).optional(),
    childIndex:z.number().int().optional(),
    pending: z
      .enum(["bombParcel", "hostage", "forkSecond", "forkChoice", "thief", "duel"])
      .optional(),
    fork: z.object({ start: snapshot, first: snapshot.optional() }).optional(),
    saveIndex: z.number().int().optional(),
    hostage: z
      .object({ target: z.string(), indices: z.array(z.number().int()) })
      .optional(),
    fixed: z.array(z.number().int()).optional(),
    sealed: z.array(z.number().int()).optional(),
    preheld: z.array(z.number().int()).optional(),
    serial: z.number().int(),
    maxRolls: z.number().int(),
    gap: z.number(),
    locked: z.number().int().nullable(),
    kept: z.array(z.number()),
    flags: z.array(z.string()),
    target: z.string().nullable(),
    extra: z.number(),
    first: snapshot.nullable(),
    oldWorld: snapshot.nullable(),
    reroll: z
      .object({
        id: z.string(),
        index: z.number().int(),
        old: z.number(),
        held: z.array(z.boolean()),
        prior: z.array(z.number()).optional(),
      })
      .nullable(),
    chooseOld: z
      .object({ index: z.number().int(), old: z.number() })
      .nullable(),
    erase: z.string().nullable(),
    parallel: z.string().nullable(),
  }),
  duels: z.array(
    z.object({
      a: z.string(),
      b: z.string(),
      aScore: z.number().nullable(),
      bScore: z.number().nullable(),
      after: z.number(),
      accepted: z.boolean().default(false),
    }),
  ),
  jackpot: z.object({after: z.number(), entries: z.array(z.object({id: z.string(), score: z.number().nullable()})), pot: z.number()}).optional(),
  custody:z.array(z.object({a:z.string(),b:z.string(),face:z.number().nullable(),aLeft:z.number(),bLeft:z.number(),aPaid:z.number().default(0),bPaid:z.number().default(0)})).optional(),
  crown:z.object({holder:z.string(),threshold:z.number(),claimed:z.boolean(),finished:z.boolean(),entries:z.array(z.object({id:z.string(),left:z.number()}))}).optional(),
});
export type AugmentState = z.infer<typeof augmentStateSchema>;
export type AugmentPlayer = z.infer<typeof augmentPlayerSchema>;
export type AugmentInstance = AugmentPlayer["items"][number];
export function canTradeGold(item: AugmentInstance) {
  const def=AUGMENTS.find(d=>d.id===item.id);
  return item.borrowedAt===undefined && def?.rarity==='gold' &&
    (def.charges<=0 || item.remaining>0 || ['artisan','fakeHouse'].includes(item.id) ||
      item.id==='parasite' && !!item.target && (item.earned??0)<40);
}
export const newAugmentPlayer = (): AugmentPlayer => ({
  items: [],
  offers: [],
  rerolled: [false, false, false],
  seenOffers: [],
  flashOffer: false,
  bonus: 0,
  rawUpper: 0,
  streak: 0,
  savingsPaid: false,
  previousZero: false,
  archive: [],
  scoreSwapped: false,
  roundIncome: {},
  curse: null,
});
