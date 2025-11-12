source "https://rubygems.org"

# GitHub Pages 사용을 위한 설정
gem "github-pages", group: :jekyll_plugins

# 플러그인 설정
group :jekyll_plugins do
  gem "jekyll-feed", "~> 0.12"
  gem "jekyll-sitemap"
  gem "jekyll-seo-tag"
  gem "jekyll-paginate"
  gem "jekyll-relative-links"
end

# Windows 및 JRuby 환경을 위한 설정
platforms :mingw, :x64_mingw, :mswin, :jruby do
  gem "tzinfo", ">= 1", "< 3"
  gem "tzinfo-data"
end

# Windows 환경에서의 성능 향상을 위한 설정
gem "wdm", "~> 0.1", :platforms => [:mingw, :x64_mingw, :mswin]

# JRuby 빌드를 위한 설정
gem "http_parser.rb", "~> 0.6.0", :platforms => [:jruby]

# 웹브라우저 자동 새로고침 기능
gem 'webrick'
