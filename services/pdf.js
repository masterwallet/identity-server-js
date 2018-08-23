const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const pixelWidth = require('string-pixel-width');

const pdf = async ({ res, walletId, json }) => {

  // Set up pdf
  let doc = new PDFDocument({
    autoFirstPage: false
  });
  const filename = `${walletId}.pdf`;

  // Genetate page with MASTERWALLET title
  const companyName = 'MASTERWALLET.PRO';
  const docSize = [280, 680];
  const origin = [125, 120];

  doc.addPage({
    layout: 'landscape',
    size: docSize,
    margin: 0,
    padding: 0,
  });

  try {
    const wallet = json.wallets.find(w => w.id === walletId);
    const address = wallet && wallet.address ? wallet.address : null;
    const privateKey = wallet && wallet.privateKey ? wallet.privateKey : null;
    const publicKey = wallet && wallet.publicKey ? wallet.publicKey : null;

    // Header
    if (wallet) {
      const network = wallet.network
      doc.rotate(-90, { origin });
      doc.x = -30;
      doc.y = 5;
      doc.image(`${__dirname}/../img/${network}.png`, { width: 30 });
      doc.x = 5;
      doc.y = 12;
      doc.font('Courier-Bold').fontSize(24).text(companyName);
      doc.rotate(90, { origin });
    }
    if (!wallet) {
      // Missing wallet = error message in PDF
      throw new Error('Error: \n wallet not found!');
    }

    // In case only address or public key is available
    if ((address || publicKey) && !privateKey) {
      // Fixed numbers
      const addrPKQR = await QRCode.toDataURL(address || publicKey);
      doc.y = 40;
      doc.x = 60;
      doc.font('Courier-Bold').fontSize(15).text(`${address ? 'Address' : ''}${!address && publicKey ? 'Public Key' : ''}:`);
      doc.moveDown(1);
      doc.font('Courier').fontSize(10).text(address || publicKey);
      doc.moveDown();
      doc.x = doc.x + 25;
      doc.image(addrPKQR);

    } else {
      // Autoresize
      const gap = 20;
      const x = 60;
      const font = 'Courier New';
      let size = 7;
      let x2 = pixelWidth(address || publicKey, { font, size }) + gap + x;
      const availWidth = docSize[1] - x - gap; // 630

      for (let i = 7; i < 13; i++) {
        const leftColWidth = pixelWidth(address || publicKey, { font, size: i }) + gap;
        const rightColWidth = pixelWidth(privateKey, { font, size: i }) + gap;
        size = i;
        x2 = leftColWidth + x;
        //console.log(size, x2);
        if (leftColWidth + rightColWidth >= availWidth) {
          break;
        }
      }

      if (address || publicKey) {
        // Display address and QR
        const addrPKQR = await QRCode.toDataURL(address || publicKey);
        doc.y = 40;
        doc.x = x;
        doc.font('Courier-Bold').fontSize(15).text(`${address ? 'Address' : ''}${!address && publicKey ? 'Public Key' : ''}:`);
        doc.moveDown(1);
        doc.font('Courier').fontSize(size).text(address || publicKey);
        doc.moveDown();
        doc.x = x + 25;
        doc.image(addrPKQR);
      }
      
      if (privateKey) {
        const pkQR = await QRCode.toDataURL(privateKey);
        doc.y = 40;
        doc.x = x2;
        doc.font('Courier-Bold').fontSize(15).text('Private Key:');
        doc.moveDown(1);
        doc.font('Courier').fontSize(size).text(privateKey, {
          //width: 320, align: 'right' 
        });
        doc.moveDown();
        doc.x = x2 + 35;
        doc.image(pkQR);
      }
    }

  } catch (e) {
    // Display error in PDF
    // Generate plain doc with title and error
    let doc = new PDFDocument({
      autoFirstPage: false
    });
    doc.addPage({
      layout: 'landscape',
      size: docSize,
      margin: 0,
      padding: 0,
    });
    doc.rotate(-90, { origin });
    doc.x = -5;
    doc.y = 12;
    doc.font('Courier-Bold').fontSize(24).text(companyName);
    doc.rotate(90, { origin });
    doc.x = 100;
    doc.y = 100;
    doc.font('Courier-Bold').fillColor('red').fontSize(50).text(e.message || e);
    doc.end();
    return doc;
  }
  doc.end();
  // // Rotate entire document
  // doc.page.dictionary.data.Rotate = 270;
  // doc._root.data.Pages.data.Kids[0] = doc.page.dictionary;

  return doc;
};

module.exports = {
  pdf
};