export const plainTextNotification = `
The Kiali team is happy to announce the availability of Kiali {{var:version:""}}.

To install Kiali, you can follow the getting started guide (https://www.kiali.io/documentation/getting-started/), which contains the up-to-date install instructions.

Find the artifacts for this release:

* The Kiali operator image at Quay.io - https://quay.io/repository/kiali/kiali-operator?tab=tags
* The Kiali image at Quay.io - https://quay.io/repository/kiali/kiali?tab=tags
* The Kiali UI at NPM registry - https://www.npmjs.com/package/@kiali/kiali-ui

Check our YouTube channel (https://www.youtube.com/channel/UCcm2NzDN_UCZKk2yYmOpc5w) to find a video demoing the new features for this release. If you prefer to read, check our Medium feed (https://medium.com/kialiproject) where we write about the updates (although with a little delay).

A courtesy reminder to follow us through Twitter: https://twitter.com/KialiProject

Enjoy!`;

export const htmlNotification = `
<html>
  <head>
    <link href="https://fonts.googleapis.com/css?family=Lato&display=swap" rel="stylesheet">
  </head>
  <body style="font-family: 'Lato', sans-serif; padding: 1em">
    <div style="background-color: #003145; padding: 0.5em">
      <img src="https://raw.githubusercontent.com/kiali/kiali-bot/master/assets/kiali_logo_darkbkg_40hpx.png"
           alt="Kiali logo" width="128" height="40" />
    </div>
    
    <p style="font-size: 120%">
      The Kiali team is happy to announce the availability of Kiali {{var:version:""}}.
    </p>
    
    <div style="margin-left: 2em; font-size: 85%">
      <p>
        To install Kiali, you can follow the
        <a href="https://www.kiali.io/documentation/getting-started/">
          getting started guide</a> available at our website, which contains
        the up-to-date install instructions.
      </p>

      <p>
        Find the artifacts for this release:
      </p>
      
      <ul>
        <li><a href="https://quay.io/repository/kiali/kiali-operator?tab=tags">
          The Kiali operator image at Quay.io</a>.</li>
        <li><a href="https://quay.io/repository/kiali/kiali?tab=tags">
          The Kiali image at Quay.io</a>.</li>
        <li><a href="https://www.npmjs.com/package/@kiali/kiali-ui">
          The Kiali UI at NPM registry</a>.</li>
      </ul>
      
      <p>
        Check our <a href="https://www.youtube.com/channel/UCcm2NzDN_UCZKk2yYmOpc5w">
        YouTube channel</a> to find a video demoing the new features for this
        release. If you prefer to read, check our
        <a href="https://medium.com/kialiproject">Medium feed</a>
        where we write about the updates (although with a small delay after the release). 
      </p>
      
      <p>
        A courtesy reminder to <a href="https://twitter.com/KialiProject">
        follow us through Twitter</a>.
      </p>
    </div>
    
    <p style="font-size: 120%">
      Enjoy!
    </p>
  </body>
</html>`;
