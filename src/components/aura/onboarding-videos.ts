// onboarding-videos.ts — registre des vidéos « Comment ça marche » publiées.
//
// Une entrée par application et par langue. Les masters sont rendus avec
// Remotion (remotion/src/OnboardingVideo.tsx) sur le même script que le lecteur
// in-app, puis servis depuis le CDN projet. Une entrée absente n'est pas une
// erreur : le lecteur retombe simplement sur la lecture par chapitres.
import architecturerFr from "../../assets/onboarding/architecturer-fr.mp4.asset.json";
import architecturerEn from "../../assets/onboarding/architecturer-en.mp4.asset.json";
import deciderFr from "../../assets/onboarding/decider-fr.mp4.asset.json";
import deciderEn from "../../assets/onboarding/decider-en.mp4.asset.json";
import copiloteFr from "../../assets/onboarding/copilote-fr.mp4.asset.json";
import copiloteEn from "../../assets/onboarding/copilote-en.mp4.asset.json";

const VIDEOS: Record<string, { url: string }> = {
  architecturer_fr: architecturerFr,
  architecturer_en: architecturerEn,
  decider_fr: deciderFr,
  decider_en: deciderEn,
  copilote_fr: copiloteFr,
  copilote_en: copiloteEn,
};

export function onboardingVideoUrl(app: string, lang: "fr" | "en"): string | null {
  return VIDEOS[`${app}_${lang}`]?.url ?? null;
}
