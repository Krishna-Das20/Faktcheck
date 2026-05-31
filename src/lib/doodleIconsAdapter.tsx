/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import {
  Arrow as DoodleArrow,
  ECommerce as DoodleECommerce,
  Files as DoodleFiles,
  Finance as DoodleFinance,
  Interfaces as DoodleInterfaces,
  Misc as DoodleMisc,
  Objects as DoodleObjects,
  Weather as DoodleWeather,
} from "doodle-icons";

interface IconProps {
  className?: string;
  size?: number;
  style?: React.CSSProperties;
  [key: string]: any;
}

const doodle = (Component: any) => {
  if (!Component) {
    return null;
  }

  const DoodleIcon = ({ className, size = 24, style, ...props }: IconProps) => (
    <Component
      width={size}
      height={size}
      className={className}
      fill="currentColor"
      style={{ color: "currentColor", ...style }}
      {...props}
    />
  );
  DoodleIcon.displayName = `DoodleIcon`;
  return DoodleIcon;
};

const stroke =
  (paths: React.ReactNode, { viewBox = "0 0 24 24" } = {}) =>
  ({ className, size = 24, ...props }: IconProps) => (
    <svg
      viewBox={viewBox}
      width={size}
      height={size}
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {paths}
    </svg>
  );

const circleIcon = stroke(<circle cx="12" cy="12" r="8.5" />);
const circleDotIcon = stroke(
  <>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
  </>
);
const checkCircleIcon = stroke(
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M8.7 12.2 11 14.5l4.7-5" />
  </>
);
const checkSquareIcon = stroke(
  <>
    <rect x="4" y="4" width="16" height="16" rx="3" />
    <path d="M8.5 12.2 10.9 14.5 15.7 9.6" />
  </>
);
const chevronDownIcon = stroke(<path d="m6 9 6 6 6-6" />);
const chevronLeftIcon = stroke(<path d="m14.5 6-6 6 6 6" />);
const chevronRightIcon = stroke(<path d="m9.5 6 6 6-6 6" />);
const chevronUpIcon = stroke(<path d="m6 15 6-6 6 6" />);
const gripHorizontalIcon = stroke(
  <>
    <path d="M5 9h14" />
    <path d="M5 15h14" />
  </>
);
const gripVerticalIcon = stroke(
  <>
    <path d="M9 5v14" />
    <path d="M15 5v14" />
  </>
);
const hashIcon = stroke(
  <>
    <path d="M9 4 7 20" />
    <path d="M17 4 15 20" />
    <path d="M4 9h16" />
    <path d="M3 15h16" />
  </>
);
const libraryIcon = stroke(
  <>
    <path d="M5 5.5h5.5a3 3 0 0 1 3 3V19H8a3 3 0 0 0-3 3" />
    <path d="M19 5.5h-5.5a3 3 0 0 0-3 3V19H16a3 3 0 0 1 3 3" />
  </>
);
const loaderIcon = stroke(<path d="M20 12a8 8 0 1 1-2.35-5.65" />);
const medalIcon = stroke(
  <>
    <path d="M9 4h6l-1.2 5H10.2z" />
    <circle cx="12" cy="14" r="4.2" />
    <path d="m10 17.5 2-1.2 2 1.2" />
  </>
);
const minusIcon = stroke(<path d="M6 12h12" />);
const minusCircleIcon = stroke(
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M8 12h8" />
  </>
);
const mousePointerIcon = stroke(
  <path d="m7 4 10 7-4 1 2.5 5-2.2 1.1-2.6-5-3.7 3.5z" />
);
const plusIcon = stroke(
  <>
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </>
);
const shareIcon = stroke(
  <>
    <circle cx="6" cy="12" r="2" />
    <circle cx="18" cy="7" r="2" />
    <circle cx="18" cy="17" r="2" />
    <path d="m7.8 11 8.2-3" />
    <path d="m7.8 13 8.2 3" />
  </>
);
const stopCircleIcon = stroke(
  <>
    <circle cx="12" cy="12" r="8.5" />
    <rect x="9" y="9" width="6" height="6" rx="1" />
  </>
);
const typeIcon = stroke(
  <>
    <path d="M5 6h14" />
    <path d="M12 6v12" />
    <path d="M9 18h6" />
  </>
);
const usersIcon = stroke(
  <>
    <circle cx="9" cy="10" r="3" />
    <circle cx="16" cy="9" r="2.5" />
    <path d="M4.5 18c.7-2.5 2.6-4 5-4s4.3 1.5 5 4" />
    <path d="M14.2 17.2c.5-1.7 1.8-2.8 3.6-3.2" />
  </>
);
const xCircleIcon = stroke(
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="m9 9 6 6" />
    <path d="m15 9-6 6" />
  </>
);
const triangleAlertIcon = stroke(
  <>
    <path d="m12 4 8 15H4L12 4Z" />
    <path d="M12 9v4.5" />
    <path d="M12 17h.01" />
  </>
);
const aiBeautifyIcon = stroke(
  <>
    <path d="m12 3 1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9L12 3Z" />
    <path d="m19 14 1 2.3 2.3 1-2.3 1-1 2.3-1-2.3-2.3-1 2.3-1 1-2.3Z" />
    <path d="m5 14 .8 1.8 1.8.8-1.8.8L5 19.2l-.8-1.8-1.8-.8 1.8-.8L5 14Z" />
  </>
);

export const AlertTriangle = triangleAlertIcon;
export const AiBeautifyIcon = aiBeautifyIcon;
export const AlignLeft = doodle(DoodleInterfaces.LeftAlign);
export const ArrowLeft = doodle(DoodleArrow.ArrowLeft);
export const ArrowRight = doodle(DoodleArrow.ArrowRight);
export const Award = doodle(DoodleInterfaces.Trophy);
export const BarChart3 = doodle(DoodleInterfaces.Analytics);
export const Building2 = doodle(DoodleFinance.Bank);
export const Calendar = doodle(DoodleInterfaces.Calendar);
export const Camera = doodle(DoodleInterfaces.Camera);
export const Check = doodle(DoodleInterfaces.Tick);
export const CheckCircle = checkCircleIcon;
export const CheckSquare = checkSquareIcon;
export const ChevronDown = chevronDownIcon;
export const ChevronLeft = chevronLeftIcon;
export const ChevronRight = chevronRightIcon;
export const ChevronUp = chevronUpIcon;
export const Circle = circleIcon;
export const CircleDot = circleDotIcon;
export const Clipboard = doodle(DoodleFiles.FileNotes);
export const ClipboardList = doodle(DoodleInterfaces.Checklist);
export const Clock = doodle(DoodleInterfaces.Clock);
export const Code = doodle(DoodleFiles.FileCode);
export const Code2 = doodle(DoodleFiles.FileCode);
export const Copy = doodle(DoodleInterfaces.Copy);
export const Crown = doodle(DoodleObjects.Crown);
export const DoorOpen = doodle(DoodleInterfaces.Drawer);
export const Download = doodle(DoodleInterfaces.Download);
export const Edit = doodle(DoodleInterfaces.Pencil);
export const Edit2 = doodle(DoodleInterfaces.Pencil2);
export const Eye = doodle(DoodleInterfaces.Unhide);
export const EyeOff = doodle(DoodleInterfaces.Hide);
export const FileCode = doodle(DoodleFiles.FileCode);
export const FileQuestion = doodle(DoodleInterfaces.Question);
export const FileText = doodle(DoodleFiles.FileText);
export const Filter = doodle(DoodleInterfaces.Filter);
export const Flag = doodle(DoodleInterfaces.Flag);
export const Globe = doodle(DoodleInterfaces.Globe);
export const GripHorizontal = gripHorizontalIcon;
export const GripVertical = gripVerticalIcon;
export const Hash = hashIcon;
export const Image = doodle(DoodleFiles.FileImage);
export const ImageIcon = Image;
export const LayoutDashboard = doodle(DoodleInterfaces.Dashboard);
export const Library = libraryIcon;
export const Link = doodle(DoodleInterfaces.Link);
export const Link2 = doodle(DoodleInterfaces.Link);
export const Loader = loaderIcon;
export const Loader2 = loaderIcon;
export const Lock = doodle(DoodleInterfaces.Lock);
export const LogIn = doodle(DoodleInterfaces.Login);
export const LogOut = doodle(DoodleInterfaces.Logout);
export const Mail = doodle(DoodleInterfaces.Mail);
export const Maximize = doodle(DoodleInterfaces.Maximize);
export const Maximize2 = doodle(DoodleInterfaces.Maximize);
export const Medal = medalIcon;
export const Megaphone = doodle(DoodleInterfaces.Megaphone);
export const Menu = doodle(DoodleInterfaces.Menu);
export const Minimize2 = doodle(DoodleInterfaces.Minimize);
export const Minus = minusIcon;
export const MinusCircle = minusCircleIcon;
export const Monitor = doodle(DoodleObjects.Tv);
export const Moon = doodle(DoodleWeather.Night);
export const MousePointer = mousePointerIcon;
export const Paperclip = doodle(DoodleInterfaces.PaperClip);
export const Phone = doodle(DoodleInterfaces.Phone);
export const Pin = doodle(DoodleInterfaces.Pin);
export const Play = doodle(DoodleInterfaces.Play);
export const Plus = plusIcon;
export const RefreshCw = doodle(DoodleInterfaces.Sync);
export const RotateCcw = doodle(DoodleInterfaces.Sync);
export const Save = doodle(DoodleInterfaces.Floppy);
export const Search = doodle(DoodleInterfaces.Search);
export const Send = doodle(DoodleInterfaces.Send);
export const Settings = stroke(
  <>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
  </>
);
export const Share2 = shareIcon;
export const Shield = doodle(DoodleInterfaces.Shield);
export const ShieldCheck = doodle(DoodleInterfaces.Shield2);
export const StopCircle = stopCircleIcon;
export const Sun = doodle(DoodleInterfaces.Sun);
export const Tag = doodle(DoodleECommerce.Tag);
export const Target = doodle(DoodleInterfaces.Target);
export const Terminal = doodle(DoodleMisc.Server);
export const Timer = doodle(DoodleInterfaces.Stopwatch);
export const Trash2 = doodle(DoodleInterfaces.Delete);
export const TrendingUp = doodle(DoodleFinance.TrendUp);
export const Trophy = doodle(DoodleInterfaces.Trophy);
export const Type = typeIcon;
export const Upload = doodle(DoodleInterfaces.Upload);
export const User = doodle(DoodleInterfaces.User);
export const UserCheck = doodle(DoodleInterfaces.UserAdd);
export const UserPlus = doodle(DoodleInterfaces.UserAdd);
export const Users = usersIcon;
export const UserX = doodle(DoodleInterfaces.UserDelete);
export const X = doodle(DoodleInterfaces.Cross);
export const XCircle = xCircleIcon;
