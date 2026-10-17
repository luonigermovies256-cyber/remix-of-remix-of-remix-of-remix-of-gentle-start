import homeIcon from "@/assets/icons/home.png";
import trendingIcon from "@/assets/icons/trending.png";
import latestIcon from "@/assets/icons/latest.png";
import recommendedIcon from "@/assets/icons/recommended.png";
import top50Icon from "@/assets/icons/top-50.png";
import moviesIcon from "@/assets/icons/movies.png";
import dramaIcon from "@/assets/icons/drama.png";
import loveIcon from "@/assets/icons/love-story.png";
import animationIcon from "@/assets/icons/animation.png";
import oldSkullIcon from "@/assets/icons/old-skull.png";
import nigerianIcon from "@/assets/icons/nigerian.png";
import shortSeriesIcon from "@/assets/icons/short-series.png";
import liveTvIcon from "@/assets/icons/live-tv.png";
import upcomingIcon from "@/assets/icons/upcoming-selections.png";
import weekIcon from "@/assets/icons/for-the-week.png";
import learnMoreIcon from "@/assets/icons/learn-more.png";
import adminIcon from "@/assets/icons/admin.png";
import vipIcon from "@/assets/icons/vip.png";
import historyIcon from "@/assets/icons/history.png";
import appIcon from "@/assets/icons/app.png";
import searchIcon from "@/assets/icons/search.png";
import profileIcon from "@/assets/icons/profile.png";

/** 3D icon set — keys match category slugs, plus `admin`. */
export const ICONS_3D: Record<string, string> = {
  home: homeIcon,
  trending: trendingIcon,
  latest: latestIcon,
  recommended: recommendedIcon,
  "top-50": top50Icon,
  movies: moviesIcon,
  drama: dramaIcon,
  "love-story": loveIcon,
  animation: animationIcon,
  "old-skull": oldSkullIcon,
  nigerian: nigerianIcon,
  "short-series": shortSeriesIcon,
  "live-tv": liveTvIcon,
  "upcoming-selections": upcomingIcon,
  "for-the-week": weekIcon,
  "learn-more": learnMoreIcon,
  admin: adminIcon,
  vip: vipIcon,
  history: historyIcon,
  app: appIcon,
  search: searchIcon,
  profile: profileIcon,
  filter: appIcon,
};

export function Icon3D({
  name,
  className = "size-5",
  alt = "",
}: {
  name: string;
  className?: string;
  alt?: string;
}) {
  const src = ICONS_3D[name] ?? ICONS_3D["home"];
  return (
    <img
      src={src}
      alt={alt}
      aria-hidden={alt ? undefined : true}
      loading="lazy"
      width={512}
      height={512}
      className={`${className} shrink-0 object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.35)]`}
    />
  );
}
