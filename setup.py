"""Setup configuration for IndiaOptions AlgoBot."""

from setuptools import setup, find_packages

setup(
    name="india-options-algobot",
    version="1.0.0",
    description="Comprehensive options trading bot for Indian markets (NSE/BSE)",
    author="IndiaOptions",
    python_requires=">=3.11",
    packages=find_packages(),
    install_requires=[
        "numpy>=1.24.0",
        "pandas>=2.0.0",
        "scipy>=1.11.0",
        "flask>=3.0.0",
        "flask-socketio>=5.3.0",
        "flask-cors>=4.0.0",
        "plotly>=5.18.0",
        "requests>=2.31.0",
        "aiohttp>=3.9.0",
        "sqlalchemy>=2.0.0",
        "apscheduler>=3.10.0",
        "python-dotenv>=1.0.0",
        "pyyaml>=6.0.0",
        "click>=8.1.0",
        "tabulate>=0.9.0",
        "colorlog>=6.7.0",
        "ta>=0.10.2",
    ],
    extras_require={
        "zerodha": ["kiteconnect>=5.0.0"],
        "angel": ["smartapi-python>=1.3.0"],
        "dev": [
            "pytest>=7.4.0",
            "pytest-cov>=4.1.0",
            "pytest-asyncio>=0.21.0",
        ],
    },
    entry_points={
        "console_scripts": [
            "optionsbot=main:cli",
        ],
    },
)
