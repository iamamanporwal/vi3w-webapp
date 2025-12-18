// Type declarations for @google/model-viewer web component
import 'react';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          src?: string;
          alt?: string;
          'camera-controls'?: boolean | string;
          'auto-rotate'?: boolean | string;
          'interaction-policy'?: string;
          'ar'?: boolean | string;
          'ar-scale'?: string;
          'ar-modes'?: string;
          'ios-src'?: string;
          'poster'?: string;
          'environment-image'?: string;
          'exposure'?: string;
          'shadow-intensity'?: string;
          'shadow-softness'?: string;
          'animation-name'?: string;
          'animation-crossfade-duration'?: string;
          'autoplay'?: boolean | string;
          'background-color'?: string;
          'camera-orbit'?: string;
          'camera-target'?: string;
          'field-of-view'?: string;
          'min-camera-orbit'?: string;
          'max-camera-orbit'?: string;
          'min-field-of-view'?: string;
          'max-field-of-view'?: string;
          'interpolation-decay'?: string;
          'skybox-image'?: string;
          'reveal'?: string;
          'loading'?: string;
          'with-credentials'?: boolean | string;
          'touch-action'?: string;
          'disable-zoom'?: boolean | string;
          'orbit-sensitivity'?: string;
          'interaction-prompt'?: string;
          'interaction-prompt-threshold'?: string;
          'interaction-prompt-style'?: string;
          'auto-rotate-delay'?: string;
          'rotation-per-second'?: string;
          'disable-tap'?: boolean | string;
          'magic-leap'?: boolean | string;
          'ar-placement'?: string;
          'ar-interaction'?: string;
          'xr-environment'?: boolean | string;
          'skybox-height'?: string;
          'tone-mapping'?: string;
          'color-space'?: string;
          'decoding'?: string;
          'preload'?: boolean | string;
          'interpolation'?: string;
          'variant-name'?: string;
          'orientation'?: string;
          'scale'?: string;
          'bounds'?: string;
          'min-scale'?: string;
          'max-scale'?: string;
        },
        HTMLElement
      >;
    }
  }
}

export {};

