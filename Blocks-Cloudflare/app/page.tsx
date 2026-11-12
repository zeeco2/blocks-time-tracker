import { getChatGPTUser, requireChatGPTUser } from "./chatgpt-auth";
import TimeTracker from "./time-tracker";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getChatGPTUser();
  if (!user && process.env.NODE_ENV === "production") await requireChatGPTUser("/");
  return <TimeTracker displayName={user?.displayName ?? "Local preview"} />;
}
