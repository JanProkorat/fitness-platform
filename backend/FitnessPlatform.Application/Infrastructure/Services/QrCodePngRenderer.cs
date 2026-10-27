using QRCoder;

namespace FitnessPlatform.Application.Infrastructure.Services;

/// <summary>
/// Renders a payload as a QR code PNG. Uses the managed PNG renderer, which needs no System.Drawing and so
/// runs on Linux, and error correction level M as QR Platba asks.
/// </summary>
public static class QrCodePngRenderer
{
    private const int PixelsPerModule = 8;

    /// <summary>
    /// Renders the payload with a quiet zone, ready to attach to an email.
    /// </summary>
    /// <param name="payload">The text to encode.</param>
    /// <returns>The PNG image bytes.</returns>
    public static byte[] Render(string payload)
    {
        using var generator = new QRCodeGenerator();
        using var data = generator.CreateQrCode(payload, QRCodeGenerator.ECCLevel.M);
        var png = new PngByteQRCode(data);

        return png.GetGraphic(PixelsPerModule);
    }
}
