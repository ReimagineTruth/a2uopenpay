import React, { useEffect } from "react";
import { 
  FileText, 
  Shield, 
  TrendingUp, 
  CreditCard, 
  PiggyBank, 
  BarChart3, 
  Users, 
  Globe,
  CheckCircle,
  ArrowRight,
  Calendar,
  Building,
  Lock
} from "lucide-react";

const WhitepaperPage = () => {
  useEffect(() => {
    document.title = "OpenPay OpenUSD (OUSD) Whitepaper - OpenPay";
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute("content", "Comprehensive whitepaper for OpenPay OpenUSD (OUSD) - Pi Network's stable utility token for digital payments and DeFi services.");
    }
    window.scrollTo(0, 0);
  }, []);

  const features = [
    {
      icon: <CreditCard className="w-6 h-6" />,
      title: "Instant Payments",
      description: "Send & receive OUSD instantly across the Pi Network ecosystem"
    },
    {
      icon: <Shield className="w-6 h-6" />,
      title: "USD-Pegged Stability",
      description: "1:1 USD backing with transparent reserves and ecosystem value"
    },
    {
      icon: <TrendingUp className="w-6 h-6" />,
      title: "Staking & Rewards",
      description: "Earn rewards through staking, lending, and participation programs"
    },
    {
      icon: <PiggyBank className="w-6 h-6" />,
      title: "DeFi Integration",
      description: "Swap with USDT/USDC, participate in liquidity pools"
    },
    {
      icon: <BarChart3 className="w-6 h-6" />,
      title: "Merchant Solutions",
      description: "Complete POS integration for businesses and service providers"
    },
    {
      icon: <Users className="w-6 h-6" />,
      title: "Governance",
      description: "Participate in ecosystem governance with OUSD voting power"
    }
  ];

  const roadmap = [
    {
      phase: "Phase 1",
      timeline: "Q1 2026",
      title: "OUSD Launch",
      milestones: [
        "Token creation and deployment",
        "Wallet integration",
        "Basic transfer functionality",
        "Initial merchant onboarding"
      ]
    },
    {
      phase: "Phase 2",
      timeline: "Q2 2026",
      title: "Merchant Ecosystem",
      milestones: [
        "POS system integration",
        "Merchant dashboard",
        "QR payment solutions",
        "Analytics platform"
      ]
    },
    {
      phase: "Phase 3",
      timeline: "Q3 2026",
      title: "Financial Services",
      milestones: [
        "Staking platform launch",
        "Lending and borrowing",
        "Savings programs",
        "Reward mechanisms"
      ]
    },
    {
      phase: "Phase 4",
      timeline: "Q4 2026",
      title: "DeFi Expansion",
      milestones: [
        "DEX integration",
        "Liquidity pools",
        "Cross-chain compatibility",
        "Advanced trading features"
      ]
    },
    {
      phase: "Phase 5",
      timeline: "2027+",
      title: "Global Growth",
      milestones: [
        "International expansion",
        "DAO governance",
        "Payroll integration",
        "Enterprise solutions"
      ]
    }
  ];

  const useCases = [
    {
      icon: <Users className="w-8 h-8 text-blue-600" />,
      title: "Peer-to-Peer Transfers",
      description: "Instant OUSD transfers between users with minimal fees and maximum security."
    },
    {
      icon: <Building className="w-8 h-8 text-green-600" />,
      title: "Merchant Payments",
      description: "Businesses can accept OUSD payments through POS systems and online platforms."
    },
    {
      icon: <TrendingUp className="w-8 h-8 text-purple-600" />,
      title: "Staking & Savings",
      description: "Earn competitive yields by staking OUSD or participating in savings programs."
    },
    {
      icon: <BarChart3 className="w-8 h-8 text-orange-600" />,
      title: "DeFi Operations",
      description: "Swap OUSD with other stablecoins and participate in liquidity mining."
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <div className="absolute inset-0 bg-black opacity-10"></div>
        <div className="relative container mx-auto px-4 py-24">
          <div className="max-w-4xl mx-auto text-center">
            <div className="mb-6">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-white/20 backdrop-blur-sm rounded-2xl mb-6">
                <FileText className="w-10 h-10" />
              </div>
            </div>
            
            <h1 className="text-5xl md:text-6xl font-bold mb-6">
              OpenPay OpenUSD (OUSD)
            </h1>
            
            <p className="text-xl md:text-2xl mb-8 text-blue-100">
              Pi Network's USD-Pegged Utility Token for Digital Finance
            </p>
            
            <div className="flex flex-wrap justify-center gap-4 text-sm">
              <span className="px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full">
                Version 1.1
              </span>
              <span className="px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full">
                February 26, 2026
              </span>
              <span className="px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full">
                Pi Network & MrWain Foundation
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Executive Summary */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-6 text-gray-900 dark:text-white">
              Executive Summary
            </h2>
            <div className="max-w-4xl mx-auto">
              <p className="text-lg text-gray-600 dark:text-gray-300 leading-relaxed mb-6">
                <strong>OpenPay OpenUSD (OUSD)</strong> is a <strong>USD-pegged utility token</strong> issued by 
                <strong> Pi Network</strong> in collaboration with <strong>MrWain Foundation</strong>. It is designed as a 
                <strong> stable digital currency for utility within Pi ecosystem</strong>, enabling users to send & receive OUSD 
                instantly, pay merchants, participate in staking and lending programs, swap with other stablecoins, and 
                use governance features.
              </p>
              <p className="text-lg text-gray-600 dark:text-gray-300 leading-relaxed">
                OUSD combines <strong>blockchain transparency</strong> with <strong>fiat stability</strong>, serving as the 
                <strong> core utility token</strong> for OpenPay-powered apps, merchants, and DeFi services.
              </p>
            </div>
          </div>

          {/* Key Features */}
          <div className="mb-20">
            <h3 className="text-3xl font-bold mb-12 text-center text-gray-900 dark:text-white">
              Key Features
            </h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {features.map((feature, index) => (
                <div
                  key={index}
                  className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
                >
                  <div className="flex items-center mb-4">
                    <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg text-blue-600 dark:text-blue-400">
                      {feature.icon}
                    </div>
                    <h4 className="ml-4 text-xl font-semibold text-gray-900 dark:text-white">
                      {feature.title}
                    </h4>
                  </div>
                  <p className="text-gray-600 dark:text-gray-300">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Token Model */}
      <section className="py-20 px-4 bg-white dark:bg-slate-800">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-4xl font-bold mb-12 text-center text-gray-900 dark:text-white">
            Token Model
          </h2>
          
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-slate-700 dark:to-slate-700 rounded-2xl p-8 mb-12">
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">
                  Token Specifications
                </h3>
                <div className="space-y-4">
                  <div className="flex justify-between py-3 border-b border-gray-200 dark:border-gray-600">
                    <span className="font-semibold text-gray-700 dark:text-gray-300">Name</span>
                    <span className="text-gray-900 dark:text-white">OpenPay OpenUSD</span>
                  </div>
                  <div className="flex justify-between py-3 border-b border-gray-200 dark:border-gray-600">
                    <span className="font-semibold text-gray-700 dark:text-gray-300">Symbol</span>
                    <span className="text-gray-900 dark:text-white">OUSD</span>
                  </div>
                  <div className="flex justify-between py-3 border-b border-gray-200 dark:border-gray-600">
                    <span className="font-semibold text-gray-700 dark:text-gray-300">Type</span>
                    <span className="text-gray-900 dark:text-white">Utility Stablecoin</span>
                  </div>
                  <div className="flex justify-between py-3 border-b border-gray-200 dark:border-gray-600">
                    <span className="font-semibold text-gray-700 dark:text-gray-300">Peg</span>
                    <span className="text-gray-900 dark:text-white">1:1 USD</span>
                  </div>
                  <div className="flex justify-between py-3 border-b border-gray-200 dark:border-gray-600">
                    <span className="font-semibold text-gray-700 dark:text-gray-300">Issuers</span>
                    <span className="text-gray-900 dark:text-white">Pi Network & MrWain Foundation</span>
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">
                  Utility Features
                </h3>
                <div className="space-y-3">
                  {[
                    "Internal payments within Pi apps",
                    "Merchant acceptance & e-commerce",
                    "Staking rewards & lending collateral",
                    "Swap & exchange against USDT, USDC",
                    "DAO governance for feature voting"
                  ].map((feature, index) => (
                    <div key={index} className="flex items-center">
                      <CheckCircle className="w-5 h-5 text-green-500 mr-3 flex-shrink-0" />
                      <span className="text-gray-700 dark:text-gray-300">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-4xl font-bold mb-12 text-center text-gray-900 dark:text-white">
            Use Cases
          </h2>
          
          <div className="grid md:grid-cols-2 gap-8">
            {useCases.map((useCase, index) => (
              <div
                key={index}
                className="bg-white dark:bg-slate-800 rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-102"
              >
                <div className="flex items-center mb-6">
                  <div className="p-3 bg-gray-100 dark:bg-slate-700 rounded-xl">
                    {useCase.icon}
                  </div>
                  <h3 className="ml-4 text-2xl font-bold text-gray-900 dark:text-white">
                    {useCase.title}
                  </h3>
                </div>
                <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                  {useCase.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Architecture & Security */}
      <section className="py-20 px-4 bg-white dark:bg-slate-800">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-4xl font-bold mb-12 text-center text-gray-900 dark:text-white">
            Architecture & Security
          </h2>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: <Globe className="w-6 h-6" />,
                title: "Blockchain",
                description: "EVM-compatible, Pi Network integration"
              },
              {
                icon: <FileText className="w-6 h-6" />,
                title: "Token Standard",
                description: "ERC-20 / Multi-chain-ready"
              },
              {
                icon: <Shield className="w-6 h-6" />,
                title: "Reserves & Backing",
                description: "USD reserves + utility backing"
              },
              {
                icon: <Lock className="w-6 h-6" />,
                title: "Smart Contracts",
                description: "Mint, burn, swap, and staking contracts"
              },
              {
                icon: <Building className="w-6 h-6" />,
                title: "Security",
                description: "Multi-sig wallets, cold storage, audited"
              }
            ].map((item, index) => (
              <div
                key={index}
                className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-slate-700 dark:to-slate-700 rounded-xl p-6"
              >
                <div className="flex items-center mb-4">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg text-blue-600 dark:text-blue-400">
                    {item.icon}
                  </div>
                  <h3 className="ml-3 text-lg font-semibold text-gray-900 dark:text-white">
                    {item.title}
                  </h3>
                </div>
                <p className="text-gray-600 dark:text-gray-300">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Roadmap */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-4xl font-bold mb-12 text-center text-gray-900 dark:text-white">
            Development Roadmap
          </h2>
          
          <div className="space-y-8">
            {roadmap.map((phase, index) => (
              <div
                key={index}
                className="bg-white dark:bg-slate-800 rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <div className="flex flex-col md:flex-row md:items-center mb-6">
                  <div className="flex items-center mb-4 md:mb-0">
                    <div className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-bold mr-4">
                      {phase.phase}
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                        {phase.title}
                      </h3>
                      <div className="flex items-center text-gray-500 dark:text-gray-400">
                        <Calendar className="w-4 h-4 mr-2" />
                        {phase.timeline}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="grid md:grid-cols-2 gap-4">
                  {phase.milestones.map((milestone, milestoneIndex) => (
                    <div key={milestoneIndex} className="flex items-center">
                      <ArrowRight className="w-4 h-4 text-blue-500 mr-3 flex-shrink-0" />
                      <span className="text-gray-700 dark:text-gray-300">{milestone}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Conclusion */}
      <section className="py-20 px-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-4xl font-bold mb-8">
            Conclusion
          </h2>
          
          <p className="text-xl leading-relaxed mb-8 text-blue-100">
            <strong>OpenPay OpenUSD (OUSD)</strong> is a <strong>stable, utility-driven token</strong> under 
            <strong> Pi Network and MrWain Foundation</strong>, designed to empower payments, finance, and commerce. 
            It enables users to <strong>transact, earn, stake, and govern</strong> within a secure and stable ecosystem, 
            bridging traditional finance with blockchain innovation.
          </p>
          
          <div className="flex flex-wrap justify-center gap-4">
            <div className="px-6 py-3 bg-white/20 backdrop-blur-sm rounded-full">
              <Shield className="inline w-5 h-5 mr-2" />
              Stable & Secure
            </div>
            <div className="px-6 py-3 bg-white/20 backdrop-blur-sm rounded-full">
              <TrendingUp className="inline w-5 h-5 mr-2" />
              Utility-Driven
            </div>
            <div className="px-6 py-3 bg-white/20 backdrop-blur-sm rounded-full">
              <Globe className="inline w-5 h-5 mr-2" />
              Global Ready
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default WhitepaperPage;
