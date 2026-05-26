declare module 'doodle-icons' {
  import { ComponentType, SVGProps } from 'react';
  
  type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;
  
  interface IconCategory {
    [key: string]: IconComponent;
  }

  export const Arrow: IconCategory;
  export const ECommerce: IconCategory;
  export const Files: IconCategory;
  export const Finance: IconCategory;
  export const Interfaces: IconCategory;
  export const Misc: IconCategory;
  export const Objects: IconCategory;
  export const Weather: IconCategory;
}
