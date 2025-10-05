import ProfileSettings from "./components/settings/ProfileSettings";
import { useRouter } from "expo-router";

export default function SettingsScreen() {
  const router = useRouter();
  
  return <ProfileSettings onClose={() => router.back()} />;
}
