'use client';

// Push marketing (visiteurs anonymes), distinct du push staff VAPID
// existant. Pas de garde de consentement : le prompt navigateur en est déjà un.

import Script from 'next/script';

declare global {
  interface Window {
    OneSignalDeferred?: Array<(OneSignal: unknown) => void>;
  }
}

function buildInitScript(appId: string): string {
  return `
window.OneSignalDeferred = window.OneSignalDeferred || [];
OneSignalDeferred.push(function (OneSignal) {
  OneSignal.init({
    appId: ${JSON.stringify(appId)},
    // Pointe vers le SW existant (fusionné), pas OneSignalSDKWorker.js.
    serviceWorkerParam: { scope: '/' },
    serviceWorkerPath: '/sw.js',
  });
});
`;
}

export function OneSignalInit({ appId }: { appId: string }) {
  return (
    <>
      <Script
        src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js"
        strategy="afterInteractive"
        defer
      />
      <Script id="onesignal-init" strategy="afterInteractive">
        {buildInitScript(appId)}
      </Script>
    </>
  );
}

export default OneSignalInit;
