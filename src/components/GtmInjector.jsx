import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/apiClient';

export default function GtmInjector() {
  const { data: cms } = useQuery({
    queryKey: ['landing-cms'],
    queryFn: () => apiClient.entities.LandingCMS.list(),
  });

  useEffect(() => {
    const trackingGtm = cms?.[0]?.content?.tracking?.gtm;
    if (trackingGtm) {
      // Find the GTM id (GTM-XXXXXXX) using regex if they paste the full script
      const match = trackingGtm.match(/GTM-[A-Z0-9]+/i);
      const gtmId = match ? match[0] : (trackingGtm.includes('GTM-') ? trackingGtm.trim() : null);

      if (gtmId && !document.getElementById('gtm-script')) {
        // Inject script into head
        const script = document.createElement('script');
        script.id = 'gtm-script';
        script.innerHTML = `
          (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
          new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
          j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
          'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
          })(window,document,'script','dataLayer','${gtmId}');
        `;
        document.head.appendChild(script);

        // Inject noscript into body
        const noscript = document.createElement('noscript');
        noscript.id = 'gtm-noscript';
        noscript.innerHTML = `<iframe src="https://www.googletagmanager.com/ns.html?id=${gtmId}" height="0" width="0" style="display:none;visibility:hidden"></iframe>`;
        document.body.appendChild(noscript);
        
        console.log(`[GTM] Tracking initialized for ID: ${gtmId}`);
      }
    }
  }, [cms]);

  return null;
}
