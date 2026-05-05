import { createServerFn } from "@tanstack/react-start";

type SlipType = "mill" | "fgc" | "any";
type ExtractInput = { imageBase64: string; mimeType: string; slipType?: SlipType };

const SYSTEM_PROMPT = `You extract weighbridge / delivery document data from a scanned image.
Return ONLY valid JSON matching this schema (use null for unknown):
{
  "movement_type": "incoming" | "outgoing" | null,
  "src_date_of_departure": "YYYY-MM-DD" | null,
  "src_time": "HH:MM" | null,
  "src_vehicle_registration": string | null,
  "src_haulier": string | null,
  "src_delivery_note": string | null,
  "src_mill_number": string | null,
  "src_mill": string | null,
  "src_gross_mass": number | null,
  "src_tare_mass": number | null,
  "src_net_mass": number | null,
  "src_sample_number": string | null,
  "fgc_date_of_arrival": "YYYY-MM-DD" | null,
  "fgc_time": "HH:MM" | null,
  "fgc_vehicle_registration": string | null,
  "fgc_haulier": string | null,
  "fgc_consignment_note_number": string | null,
  "fgc_zsm_weighbridge_number": string | null,
  "fgc_gross_mass": number | null,
  "fgc_tare_mass": number | null,
  "fgc_net_mass": number | null,
  "fgc_brix": number | null,
  "fgc_zsm_operator": string | null,
  "driver_or_company": string | null,
  "notes": string | null,
  "raw_text": string
}
Masses are in tonnes. If document shows kilograms, convert to tonnes (divide by 1000).`;

export const extractScannedDocument = createServerFn({ method: "POST" })
  .inputValidator((data: ExtractInput) => {
    if (!data?.imageBase64 || !data?.mimeType) throw new Error("Image required");
    return data;
  })
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY missing");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              {
                type: "text",
                text:
                  data.slipType === "mill"
                    ? "This is a SOURCE MILL slip. Only fill src_* fields (and movement_type / driver if visible). Leave fgc_* fields as null. Respond with JSON only."
                    : data.slipType === "fgc"
                    ? "This is an FGC weighbridge slip. Only fill fgc_* fields (and movement_type / driver if visible). Leave src_* fields as null. Respond with JSON only."
                    : "Extract structured fields from this document. Respond with JSON only.",
              },
              { type: "image_url", image_url: { url: `data:${data.mimeType};base64,${data.imageBase64}` } },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`AI gateway error ${res.status}: ${text.slice(0, 300)}`);
    }
    const json: any = await res.json();
    const content: string = json?.choices?.[0]?.message?.content ?? "";
    const cleaned = content.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
    let parsed: any = {};
    try {
      const match = cleaned.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : {};
    } catch {
      parsed = { raw_text: cleaned };
    }
    return { fields: parsed };
  });
