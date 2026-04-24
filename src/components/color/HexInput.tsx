import { useCallback, useEffect, useState } from "react";
import type { ColorDto } from "../../api/commands";
import { colors, fontSizes, fonts, radii, sizing, spacing } from "../../styles/theme";
import { hexToRgb, rgbToHex } from "../../utils/color";

interface HexInputProps {
  color: ColorDto;
  onChange: (color: ColorDto) => void;
}

export function HexInput({ color, onChange }: HexInputProps) {
  const externalHex = rgbToHex(color.r, color.g, color.b);
  const [inputValue, setInputValue] = useState(externalHex);
  const [isFocused, setIsFocused] = useState(false);

  // Sync from external color only when not focused, to avoid overwriting
  // the user's in-progress typing and causing cursor jumps.
  useEffect(() => {
    if (!isFocused) {
      setInputValue(externalHex);
    }
  }, [externalHex, isFocused]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const filtered = e.target.value.replace(/[^#0-9a-fA-F]/g, "");
      setInputValue(filtered);
      const parsed = hexToRgb(filtered);
      if (parsed) {
        onChange({ r: parsed.r, g: parsed.g, b: parsed.b, a: 255 });
      }
    },
    [onChange],
  );

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    setInputValue(externalHex);
  }, [externalHex]);

  return (
    <>
      <span style={labelStyle}>HEX</span>
      <input
        type="text"
        value={inputValue}
        onChange={handleChange}
        onFocus={() => setIsFocused(true)}
        onBlur={handleBlur}
        style={inputStyle}
        spellCheck={false}
        maxLength={7}
      />
    </>
  );
}

const labelStyle: React.CSSProperties = {
  fontFamily: fonts.mono,
  fontSize: fontSizes.xs,
  color: colors.textSecondary,
  userSelect: "none",
  flexShrink: 0,
};

const inputStyle: React.CSSProperties = {
  fontFamily: fonts.mono,
  fontSize: fontSizes.xs,
  color: colors.textTitle,
  background: colors.inputField,
  border: "none",
  borderRadius: radii.md,
  height: sizing.button.xs,
  padding: `0 ${spacing.md}px`,
  flexGrow: 1,
  minWidth: 0,
  outline: "none",
  boxSizing: "border-box",
};
