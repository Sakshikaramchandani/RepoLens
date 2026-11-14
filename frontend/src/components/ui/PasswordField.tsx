import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useTranslation } from "../../hooks/useTranslation";
import { TextField, type TextFieldProps } from "./TextField";

export function PasswordField(props: Omit<TextFieldProps, "type" | "endAdornment">) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const toggleLabel = visible ? t("password.hide") : t("password.show");

  return (
    <TextField
      {...props}
      type={visible ? "text" : "password"}
      endAdornment={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={toggleLabel}
          aria-pressed={visible}
          title={toggleLabel}
          className="rl-press grid size-8 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-ink"
        >
          {visible ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
        </button>
      }
    />
  );
}
