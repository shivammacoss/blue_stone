// TradingView Advanced Chart Container Component
// Uses the charting library from advance_chart folder with custom datafeed

import { useEffect, useRef, useState } from 'react'
import Datafeed from './datafeed'

const TVChartContainer = ({ 
  symbol = 'XAUUSD', 
  interval = '5',
  theme = 'dark',
  autosize = true,
  fullscreen = false,
  className = '',
  style = {},
  onChartReady = () => {},
  containerId = 'tv_chart_container'
}) => {
  const chartContainerRef = useRef(null)
  const tvWidgetRef = useRef(null)
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    // Check if TradingView library is loaded
    if (!window.TradingView) {
      // Load the charting library script from public folder
      const script = document.createElement('script')
      script.src = '/charting_library/charting_library.standalone.js'
      script.async = true
      script.onload = () => {
        console.log('[TVChart] Library loaded successfully')
        initChart()
      }
      script.onerror = (e) => {
        console.error('[TVChart] Failed to load library:', e)
        setError('Failed to load TradingView library')
      }
      document.head.appendChild(script)
    } else {
      initChart()
    }

    return () => {
      if (tvWidgetRef.current) {
        tvWidgetRef.current.remove()
        tvWidgetRef.current = null
      }
    }
  }, [])

  // Update symbol when it changes
  useEffect(() => {
    if (tvWidgetRef.current && isReady) {
      try {
        tvWidgetRef.current.setSymbol(symbol, interval, () => {
          console.log('[TVChart] Symbol changed to:', symbol)
        })
      } catch (e) {
        console.error('[TVChart] Error changing symbol:', e)
      }
    }
  }, [symbol, isReady])

  // Update theme when it changes
  useEffect(() => {
    if (tvWidgetRef.current && isReady) {
      try {
        tvWidgetRef.current.changeTheme(theme === 'dark' ? 'Dark' : 'Light')
      } catch (e) {
        console.error('[TVChart] Error changing theme:', e)
      }
    }
  }, [theme, isReady])

  const initChart = () => {
    if (!window.TradingView || !chartContainerRef.current) {
      console.error('[TVChart] TradingView not loaded or container not found')
      return
    }

    try {
      const widgetOptions = {
        symbol: symbol,
        interval: interval,
        container: chartContainerRef.current,
        datafeed: Datafeed,
        library_path: '/charting_library/',
        locale: 'en',
        theme: theme === 'dark' ? 'Dark' : 'Light',
        autosize: autosize,
        fullscreen: fullscreen,
        timezone: 'Etc/UTC',
        
        // UI Configuration
        toolbar_bg: theme === 'dark' ? '#0d0d0d' : '#ffffff',
        
        // Enabled features
        enabled_features: [
          'study_templates',
          'use_localstorage_for_settings',
          'save_chart_properties_to_local_storage',
          'side_toolbar_in_fullscreen_mode',
          'header_in_fullscreen_mode',
          'hide_left_toolbar_by_default',
          'move_logo_to_main_pane',
          'header_widget',
          'header_symbol_search',
          'symbol_search_hot_key',
          'header_resolutions',
          'header_chart_type',
          'header_settings',
          'header_indicators',
          'header_compare',
          'header_undo_redo',
          'header_screenshot',
          'header_fullscreen_button',
          'left_toolbar',
          'control_bar',
          'timeframes_toolbar',
          'legend_widget',
          'display_market_status',
          'popup_hints',
          'chart_crosshair_menu',
          'pane_context_menu',
          'scales_context_menu',
          'legend_context_menu',
          'main_series_scale_menu',
          'drawing_templates',
        ],
        
        // Disabled features
        disabled_features: [
          'volume_force_overlay',
          'create_volume_indicator_by_default',
          'header_compare',
          'display_market_status',
          'go_to_date',
          'use_localstorage_for_settings',
        ],
        
        // Chart styling
        overrides: {
          'paneProperties.background': theme === 'dark' ? '#0d0d0d' : '#ffffff',
          'paneProperties.backgroundType': 'solid',
          'paneProperties.vertGridProperties.color': theme === 'dark' ? '#1a1a1a' : '#f0f0f0',
          'paneProperties.horzGridProperties.color': theme === 'dark' ? '#1a1a1a' : '#f0f0f0',
          'scalesProperties.textColor': theme === 'dark' ? '#AAA' : '#333',
          'scalesProperties.lineColor': theme === 'dark' ? '#333' : '#ccc',
          'mainSeriesProperties.candleStyle.upColor': '#26a69a',
          'mainSeriesProperties.candleStyle.downColor': '#ef5350',
          'mainSeriesProperties.candleStyle.borderUpColor': '#26a69a',
          'mainSeriesProperties.candleStyle.borderDownColor': '#ef5350',
          'mainSeriesProperties.candleStyle.wickUpColor': '#26a69a',
          'mainSeriesProperties.candleStyle.wickDownColor': '#ef5350',
        },
        
        // Studies overrides
        studies_overrides: {
          'volume.volume.color.0': '#ef5350',
          'volume.volume.color.1': '#26a69a',
        },
        
        // Loading screen
        loading_screen: {
          backgroundColor: theme === 'dark' ? '#0d0d0d' : '#ffffff',
          foregroundColor: theme === 'dark' ? '#2962FF' : '#2962FF',
        },
        
        // Custom CSS
        custom_css_url: '',
        
        // Debug mode (disable in production)
        debug: false,
      }

      console.log('[TVChart] Creating widget with options:', { symbol, interval, theme })
      
      const tvWidget = new window.TradingView.widget(widgetOptions)
      tvWidgetRef.current = tvWidget

      tvWidget.onChartReady(() => {
        console.log('[TVChart] Chart is ready')
        setIsReady(true)
        setError(null)
        onChartReady(tvWidget)
        
        // Apply additional chart settings
        const chart = tvWidget.activeChart()
        if (chart) {
          // Set chart type to candlesticks
          chart.setChartType(1)
        }
      })
    } catch (err) {
      console.error('[TVChart] Error initializing chart:', err)
      setError(err.message)
    }
  }

  if (error) {
    return (
      <div 
        className={`flex items-center justify-center ${className}`}
        style={{ 
          backgroundColor: theme === 'dark' ? '#0d0d0d' : '#ffffff',
          color: theme === 'dark' ? '#fff' : '#333',
          ...style 
        }}
      >
        <div className="text-center p-4">
          <p className="text-red-500 mb-2">Chart Error</p>
          <p className="text-sm opacity-70">{error}</p>
          <button 
            onClick={() => { setError(null); initChart(); }}
            className="mt-3 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div 
      ref={chartContainerRef}
      id={containerId}
      className={className}
      style={{ 
        width: '100%', 
        height: '100%',
        ...style 
      }}
    />
  )
}

export default TVChartContainer
