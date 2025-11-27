import { Octokit } from 'octokit';

// Hardcoded for verification context (from .env)
const TOKEN = process.env.GITHUB_TOKEN || 'YOUR_TOKEN_HERE';
const USERNAME = 'halim714';

async function verify() {
  console.log('🚀 Starting Smart Backend Verification...');
  console.log(`👤 User: ${USERNAME}`);

  const octokit = new Octokit({ auth: TOKEN });

  const results = {
    privateRepo: { name: 'miki-data', exists: false, hasPosts: false },
    publicRepo: { name: 'harim.github.io', exists: false, hasConfig: false }
  };

  // 1. Check Private Repo (miki-data)
  try {
    console.log(`\n🔍 Checking Private Repo: ${results.privateRepo.name}...`);
    await octokit.rest.repos.get({ owner: USERNAME, repo: results.privateRepo.name });
    results.privateRepo.exists = true;
    console.log('   ✅ Repository exists');

    // Check content
    try {
      const { data } = await octokit.rest.repos.getContent({
        owner: USERNAME,
        repo: results.privateRepo.name,
        path: 'miki-editor/posts'
      });
      if (Array.isArray(data)) {
        results.privateRepo.hasPosts = true;
        console.log(`   ✅ 'posts' folder found (${data.length} files)`);
      }
    } catch (e) {
      console.log('   ❌ 'posts' folder NOT found');
    }
  } catch (e) {
    console.log('   ❌ Repository NOT found');
  }

  // 2. Check Public Repo (harim.github.io)
  try {
    console.log(`\n🔍 Checking Public Repo: ${results.publicRepo.name}...`);
    await octokit.rest.repos.get({ owner: USERNAME, repo: results.publicRepo.name });
    results.publicRepo.exists = true;
    console.log('   ✅ Repository exists');

    // Check config
    try {
      await octokit.rest.repos.getContent({
        owner: USERNAME,
        repo: results.publicRepo.name,
        path: '_config.yml'
      });
      results.publicRepo.hasConfig = true;
      console.log('   ✅ '_config.yml' found');
    } catch (e) {
      console.log('   ❌ '_config.yml' NOT found');
    }
  } catch (e) {
    console.log('   ❌ Repository NOT found');
  }

  // Summary
  console.log('\n📊 Verification Summary:');
  const success = results.privateRepo.exists && results.publicRepo.exists;

  if (success) {
    console.log('✅ MIGRATION SUCCESSFUL');
    console.log('   Both repositories are set up and accessible.');
  } else {
    console.log('❌ MIGRATION INCOMPLETE');
    console.log('   One or more repositories are missing.');
  }
}

verify().catch(console.error);
