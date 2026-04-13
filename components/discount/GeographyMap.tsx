"use client";

import { memo } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
} from "react-simple-maps";
import { FORUM_GAP_ISO3 } from "@/lib/discount-country";

const geoUrl =
  "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

function isoFromGeo(geo: {
  id?: string;
  properties: Record<string, unknown>;
}): string {
  const p = geo.properties;
  const a3 = p.ISO_A3 ?? p.ISO_A3_EH ?? p.ADM0_A3;
  if (typeof a3 === "string" && a3.length === 3 && a3 !== "-99") {
    return a3;
  }
  return "";
}

interface GeographyMapProps {
  countsByIso: Record<string, number>;
}

function fillColor(
  iso: string,
  count: number,
  maxCount: number
): { fill: string; stroke: string; strokeWidth: number } {
  const isForumGap = (FORUM_GAP_ISO3 as readonly string[]).includes(iso);
  if (isForumGap) {
    if (count > 0) {
      return {
        fill: "#ea580c",
        stroke: "#9a3412",
        strokeWidth: 1.25,
      };
    }
    return {
      fill: "#ffedd5",
      stroke: "#ea580c",
      strokeWidth: 1.1,
    };
  }
  if (count <= 0) {
    return {
      fill: "#F5F2EC",
      stroke: "#D0CCC4",
      strokeWidth: 0.35,
    };
  }
  const t = maxCount > 0 ? count / maxCount : 1;
  const alpha = 0.2 + 0.55 * t;
  return {
    fill: `rgba(30, 58, 138, ${alpha})`,
    stroke: "#94a3b8",
    strokeWidth: 0.35,
  };
}

export const GeographyMap = memo(function GeographyMap({
  countsByIso,
}: GeographyMapProps) {
  const values = Object.values(countsByIso);
  const maxCount = Math.max(1, ...values, 0);

  return (
    <div className="w-full">
      <ComposableMap
        projectionConfig={{ scale: 140, center: [0, 20] }}
        className="w-full max-h-[420px] text-[#1e293b]"
      >
        <Geographies geography={geoUrl}>
          {({ geographies }) =>
            geographies.map((geo) => {
              const iso = isoFromGeo(geo);
              const count = iso ? (countsByIso[iso] ?? 0) : 0;
              const { fill, stroke, strokeWidth } = fillColor(
                iso,
                count,
                maxCount
              );
              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={strokeWidth}
                  style={{
                    default: { outline: "none" },
                    hover: { outline: "none", filter: "brightness(0.97)" },
                    pressed: { outline: "none" },
                  }}
                />
              );
            })
          }
        </Geographies>
      </ComposableMap>
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-text-secondary">
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-3 w-5 rounded-sm border border-[#9a3412]"
            style={{ background: "#ea580c" }}
          />
          Forum-gap focus (India, Romania) — failure volume
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-3 w-5 rounded-sm border border-[#ea580c]"
            style={{ background: "#ffedd5" }}
          />
          Forum-gap countries (highlight even at 0)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-3 w-5 rounded-sm border border-[#94a3b8]"
            style={{ background: "rgba(30, 58, 138, 0.45)" }}
          />
          Other failures (by count)
        </span>
      </div>
    </div>
  );
});
