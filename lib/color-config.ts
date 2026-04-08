export interface ColorConfig {
  backgroundColor?: string;
  textColor?: string;
  buttonColor?: string;
  buttonTextColor?: string;
  headerColor?: string;
  headerTextColor?: string;
  accentColor?: string;
}

export const DEFAULT_COLORS: ColorConfig = {
  backgroundColor: '#f8f6f2',
  textColor: '#1a1a1a',
  buttonColor: '#8E3800',
  buttonTextColor: '#ffffff',
  headerColor: '#ffffff',
  headerTextColor: '#1a1a1a',
  accentColor: '#6b8e23',
};

export async function fetchColorConfig(
  businessId: string | null,
  pageType: string
): Promise<ColorConfig> {
  if (!businessId) {
    return DEFAULT_COLORS;
  }

  try {
    const response = await fetch(
      `/api/business/color-config?businessId=${businessId}&pageType=${pageType}`,
      { credentials: 'include' }
    );

    if (!response.ok) {
      return DEFAULT_COLORS;
    }

    const data = await response.json();
    if (data.config) {
      return {
        backgroundColor: data.config.background_color || DEFAULT_COLORS.backgroundColor,
        textColor: data.config.text_color || DEFAULT_COLORS.textColor,
        buttonColor: data.config.button_color || DEFAULT_COLORS.buttonColor,
        buttonTextColor: data.config.button_text_color || DEFAULT_COLORS.buttonTextColor,
        headerColor: data.config.header_color || DEFAULT_COLORS.headerColor,
        headerTextColor: data.config.header_text_color || DEFAULT_COLORS.headerTextColor,
        accentColor: data.config.accent_color || DEFAULT_COLORS.accentColor,
      };
    }
    return DEFAULT_COLORS;
  } catch (error) {
    console.error('[v0] Error fetching color config:', error);
    return DEFAULT_COLORS;
  }
}
