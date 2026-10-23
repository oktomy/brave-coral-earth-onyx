import raw from "./cameras.json";

export type PrefectureId =
  | "hokkaido"
  | "aomori"
  | "iwate"
  | "miyagi"
  | "akita"
  | "yamagata"
  | "fukushima"
  | "ibaraki"
  | "tochigi"
  | "gunma"
  | "saitama"
  | "chiba"
  | "tokyo"
  | "kanagawa"
  | "niigata"
  | "toyama"
  | "ishikawa"
  | "fukui"
  | "yamanashi"
  | "nagano"
  | "gifu"
  | "shizuoka"
  | "aichi"
  | "mie"
  | "shiga"
  | "kyoto"
  | "osaka"
  | "hyogo"
  | "nara"
  | "wakayama"
  | "tottori"
  | "shimane"
  | "okayama"
  | "hiroshima"
  | "yamaguchi"
  | "tokushima"
  | "kagawa"
  | "ehime"
  | "kochi"
  | "fukuoka"
  | "saga"
  | "nagasaki"
  | "kumamoto"
  | "oita"
  | "miyazaki"
  | "kagoshima"
  | "okinawa";

export type RegionId =
  | "all"
  | "hokkaido"
  | "tohoku"
  | "kanto"
  | "chubu"
  | "kinki"
  | "chugoku"
  | "shikoku"
  | "kyushu";

export type CameraKind = "fixed" | "semi" | "mobile" | "osm" | "guide";
export type Accuracy = "survey" | "road" | "approx";
export type CameraStatus = "active" | "maybe-removed";

export type Camera = {
  id: string;
  name: string;
  prefecture: PrefectureId;
  city: string;
  road: string;
  direction: string;
  kind: CameraKind;
  system: string;
  /** Posted road limit near the point, not the speed that triggers a photo. */
  limitKph: number | null;
  lat: number;
  lon: number;
  accuracy: Accuracy;
  status: CameraStatus;
  note: string;
  source: string;
  updated: string;
};

export const REGIONS: { id: RegionId; label: string; prefectures: PrefectureId[] }[] = [
  { id: "all", label: "全國", prefectures: [] },
  { id: "hokkaido", label: "北海道", prefectures: ["hokkaido"] },
  { id: "tohoku", label: "東北", prefectures: ["aomori", "iwate", "miyagi", "akita", "yamagata", "fukushima"] },
  {
    id: "kanto",
    label: "關東",
    prefectures: ["ibaraki", "tochigi", "gunma", "saitama", "chiba", "tokyo", "kanagawa"],
  },
  {
    id: "chubu",
    label: "中部",
    prefectures: ["niigata", "toyama", "ishikawa", "fukui", "yamanashi", "nagano", "gifu", "shizuoka", "aichi"],
  },
  {
    id: "kinki",
    label: "近畿",
    prefectures: ["mie", "shiga", "kyoto", "osaka", "hyogo", "nara", "wakayama"],
  },
  { id: "chugoku", label: "中國", prefectures: ["tottori", "shimane", "okayama", "hiroshima", "yamaguchi"] },
  { id: "shikoku", label: "四國", prefectures: ["tokushima", "kagawa", "ehime", "kochi"] },
  {
    id: "kyushu",
    label: "九州・沖繩",
    prefectures: ["fukuoka", "saga", "nagasaki", "kumamoto", "oita", "miyazaki", "kagoshima", "okinawa"],
  },
];

export const PREFECTURE_LABEL: Record<PrefectureId, string> = {
  hokkaido: "北海道",
  aomori: "青森縣",
  iwate: "岩手縣",
  miyagi: "宮城縣",
  akita: "秋田縣",
  yamagata: "山形縣",
  fukushima: "福島縣",
  ibaraki: "茨城縣",
  tochigi: "栃木縣",
  gunma: "群馬縣",
  saitama: "埼玉縣",
  chiba: "千葉縣",
  tokyo: "東京都",
  kanagawa: "神奈川縣",
  niigata: "新潟縣",
  toyama: "富山縣",
  ishikawa: "石川縣",
  fukui: "福井縣",
  yamanashi: "山梨縣",
  nagano: "長野縣",
  gifu: "岐阜縣",
  shizuoka: "靜岡縣",
  aichi: "愛知縣",
  mie: "三重縣",
  shiga: "滋賀縣",
  kyoto: "京都府",
  osaka: "大阪府",
  hyogo: "兵庫縣",
  nara: "奈良縣",
  wakayama: "和歌山縣",
  tottori: "鳥取縣",
  shimane: "島根縣",
  okayama: "岡山縣",
  hiroshima: "廣島縣",
  yamaguchi: "山口縣",
  tokushima: "德島縣",
  kagawa: "香川縣",
  ehime: "愛媛縣",
  kochi: "高知縣",
  fukuoka: "福岡縣",
  saga: "佐賀縣",
  nagasaki: "長崎縣",
  kumamoto: "熊本縣",
  oita: "大分縣",
  miyazaki: "宮崎縣",
  kagoshima: "鹿兒島縣",
  okinawa: "沖繩縣",
};

export const PREFECTURE_SHORT: Record<PrefectureId, string> = {
  hokkaido: "北海道",
  aomori: "青森",
  iwate: "岩手",
  miyagi: "宮城",
  akita: "秋田",
  yamagata: "山形",
  fukushima: "福島",
  ibaraki: "茨城",
  tochigi: "栃木",
  gunma: "群馬",
  saitama: "埼玉",
  chiba: "千葉",
  tokyo: "東京",
  kanagawa: "神奈川",
  niigata: "新潟",
  toyama: "富山",
  ishikawa: "石川",
  fukui: "福井",
  yamanashi: "山梨",
  nagano: "長野",
  gifu: "岐阜",
  shizuoka: "靜岡",
  aichi: "愛知",
  mie: "三重",
  shiga: "滋賀",
  kyoto: "京都",
  osaka: "大阪",
  hyogo: "兵庫",
  nara: "奈良",
  wakayama: "和歌山",
  tottori: "鳥取",
  shimane: "島根",
  okayama: "岡山",
  hiroshima: "廣島",
  yamaguchi: "山口",
  tokushima: "德島",
  kagawa: "香川",
  ehime: "愛媛",
  kochi: "高知",
  fukuoka: "福岡",
  saga: "佐賀",
  nagasaki: "長崎",
  kumamoto: "熊本",
  oita: "大分",
  miyazaki: "宮崎",
  kagoshima: "鹿兒島",
  okinawa: "沖繩",
};

export const KINDS: { id: CameraKind | "all"; label: string }[] = [
  { id: "all", label: "全部類型" },
  { id: "fixed", label: "固定式" },
  { id: "semi", label: "半固定" },
  { id: "osm", label: "地圖標註" },
  { id: "mobile", label: "移動目擊" },
  { id: "guide", label: "指南地圖" },
];

export const KIND_LABEL: Record<CameraKind, string> = {
  fixed: "固定式",
  semi: "半固定式",
  osm: "地圖標註",
  mobile: "移動式目擊",
  guide: "指南地圖",
};

export const ACCURACY_LABEL: Record<Accuracy, string> = {
  survey: "實測座標",
  road: "吸附道路，約數百公尺",
  approx: "大約位置",
};

export const CAMERAS: Camera[] = raw as Camera[];

export function cameraSearchText(camera: Camera): string {
  return [
    camera.name,
    PREFECTURE_LABEL[camera.prefecture],
    PREFECTURE_SHORT[camera.prefecture],
    camera.city,
    camera.road,
    camera.direction,
    camera.system,
    KIND_LABEL[camera.kind],
    camera.note,
  ]
    .join(" ")
    .toLowerCase();
}
