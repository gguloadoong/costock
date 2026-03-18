'use client';

import '@coinbase/cds-web/globalStyles';
import '@coinbase/cds-web/defaultFontStyles';
import { ThemeProvider, MediaQueryProvider } from '@coinbase/cds-web/system';
import { coinbaseTheme } from '@coinbase/cds-web/themes/coinbaseTheme';

export function Providers({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <ThemeProvider theme={coinbaseTheme} activeColorScheme="light">
      <MediaQueryProvider>
        {children as React.ReactElement}
      </MediaQueryProvider>
    </ThemeProvider>
  );
}

export default Providers;
