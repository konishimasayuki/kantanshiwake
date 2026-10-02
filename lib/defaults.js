// 弥生会計の標準に合わせた初期値。設定画面で変更できる。
export const KINDS = ["資産", "負債", "純資産", "収益", "費用"];
export const T_OUT = "対象外", T_P10 = "課対仕入込10%", T_P8 = "課対仕入込軽減8%", T_S10 = "課税売上込10%";
export const DEFAULT_TAXES = [T_OUT, T_P10, T_P8, T_S10, "課税売上込軽減8%", "非課仕入", "非課売上"];

const A = (name, kind, tax) => ({ name, kind, tax });
export const DEFAULT_ACCOUNTS = [
  A("現金","資産",T_OUT),A("普通預金","資産",T_OUT),A("当座預金","資産",T_OUT),A("売掛金","資産",T_OUT),
  A("仮払金","資産",T_OUT),A("立替金","資産",T_OUT),A("前払金","資産",T_OUT),
  A("買掛金","負債",T_OUT),A("未払金","負債",T_OUT),A("預り金","負債",T_OUT),A("仮受金","負債",T_OUT),A("短期借入金","負債",T_OUT),A("長期借入金","負債",T_OUT),
  A("事業主貸","純資産",T_OUT),A("事業主借","純資産",T_OUT),
  A("売上高","収益",T_S10),A("受取利息","収益","非課売上"),A("雑収入","収益",T_S10),
  A("仕入高","費用",T_P10),A("給料手当","費用",T_OUT),A("法定福利費","費用",T_OUT),A("福利厚生費","費用",T_P10),
  A("外注費","費用",T_P10),A("荷造運賃","費用",T_P10),A("広告宣伝費","費用",T_P10),A("接待交際費","費用",T_P10),
  A("会議費","費用",T_P10),A("旅費交通費","費用",T_P10),A("通信費","費用",T_P10),A("消耗品費","費用",T_P10),
  A("事務用品費","費用",T_P10),A("車両費","費用",T_P10),A("水道光熱費","費用",T_P10),A("新聞図書費","費用",T_P10),
  A("諸会費","費用",T_OUT),A("支払手数料","費用",T_P10),A("地代家賃","費用",T_P10),A("賃借料","費用",T_P10),
  A("保険料","費用","非課仕入"),A("修繕費","費用",T_P10),A("租税公課","費用",T_OUT),A("支払利息","費用","非課仕入"),A("雑費","費用",T_P10),
];

const R = (kw, dir, account) => ({ kw, dir, account });
export const DEFAULT_RULES = [
  R("テスウリヨウ","out","支払手数料"),R("テスウリョウ","out","支払手数料"),
  R("デンキ","out","水道光熱費"),R("デンリヨク","out","水道光熱費"),R("デンリョク","out","水道光熱費"),R("ガス","out","水道光熱費"),R("スイドウ","out","水道光熱費"),
  R("NTT","out","通信費"),R("ドコモ","out","通信費"),R("ソフトバンク","out","通信費"),R("KDDI","out","通信費"),
  R("キユウヨ","out","給料手当"),R("キュウヨ","out","給料手当"),
  R("シヤカイホケン","out","法定福利費"),R("シャカイホケン","out","法定福利費"),R("ネンキン","out","法定福利費"),
  R("ヤチン","out","地代家賃"),R("ATM","out","現金"),
  R("リソク","in","受取利息"),R("リソク","out","支払利息"),
];

export const TARGETS = [
  { id: "yayoi", name: "弥生会計", ready: true, note: "仕訳日記帳インポート" },
  { id: "ics", name: "ICS", ready: false, note: "準備中" },
  { id: "tkc", name: "TKC", ready: false, note: "準備中" },
  { id: "freee", name: "freee", ready: false, note: "準備中" },
];

export function makeDefaultSettings() {
  return {
    accounts: DEFAULT_ACCOUNTS.map((a) => ({ ...a })),
    taxes: [...DEFAULT_TAXES],
    rules: DEFAULT_RULES.map((r) => ({ ...r })),
    bank: { account: "普通預金", useSub: true, inDef: "売掛金", outDef: "仮払金" },
    receipt: { cash: "現金", card: "未払金" },
    target: "yayoi",
  };
}
