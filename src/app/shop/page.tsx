import { redirect } from "next/navigation";

/** Gumroad 卖家资料「店铺链接」建议填 https://opscapital.com/shop */
export default function ShopRedirectPage() {
  redirect("/pricing");
}
